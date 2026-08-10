-- =========================================================
-- Beyen Invest — Supabase schema
-- Paste into Supabase SQL editor and run once (fresh project).
-- =========================================================
create extension if not exists pgcrypto;

-- ---------- ENUM TYPES ----------
create type fase_enum as enum ('Fase 1','Fase 2','Fase 3','Fase 4');
create type outcome_enum as enum ('Win','Loss','BE');
create type direction_enum as enum ('Long','Short'); -- universal core field (Scope C, cyclus 5 — see 0029)
create type trade_evaluation_enum as enum ('Good trade','Emotional error','Technical error','Missed trade');
create type period_type_enum as enum ('month','quarter','year');
create type pair_enum as enum (
  'AUDCAD','AUDCHF','AUDJPY','AUDNZD','AUDUSD',
  'CADCHF','CADJPY','CHFJPY',
  'EURAUD','EURCAD','EURCHF','EURGBP','EURJPY','EURNZD','EURUSD',
  'GBPAUD','GBPCAD','GBPCHF','GBPJPY','GBPNZD','GBPUSD',
  'NZDCAD','NZDCHF','NZDJPY','NZDUSD',
  'USDCAD','USDCHF','USDJPY',
  'XAGUSD','XAUUSD'
);
create type weekly_criteria_enum as enum ('Pattern','High/Low','IC','Region');
create type weekly_kenmerk_enum as enum ('Trending market','Corrective market','Ranging market');
-- trade_concept intentionally has no enum type — it's plain text (fixed
-- TRADE_CONCEPTS list + per-user custom_options), same exception as `entry`
-- below. See 0018_custom_trade_concepts.sql / 0010_custom_entries.sql.
create type cc_enum as enum ('03','07','11','15','19','23');
create type sessie_enum as enum ('Asia','London','Overlap','New York');
create type structuur_enum as enum ('Inner','Outer');
create type prop_fase_enum as enum ('Phase 1','Phase 2','Funded','Private');

-- ---------- PROFILES ----------
-- 1:1 with auth.users, auto-provisioned by the trigger below. `plan` defaults
-- to 'free' as the hook point for a future billing integration — no billing
-- logic exists yet, this just avoids a backfill migration later.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  plan text not null default 'free',
  role text not null default 'user' check (role in ('user', 'admin')),
  hide_fase boolean not null default false,
  -- IANA timezone the user reads candle-close (cc) times in. Drives the
  -- timezone-aware `trades.sessie` mapping (see compute_sessie / 0019). Default
  -- is the reference zone the methodology was authored in.
  timezone text not null default 'Europe/Brussels',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- BACKTEST PROJECTS (created before trades — trades FK into it) ----------
-- A trade belongs to the live Journal when backtest_project_id IS NULL, or to
-- exactly one isolated backtest project when set — never both, never shared.
create table backtest_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  naam text not null,
  beschrijving text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- WEEKLY REVIEWS (created before trades — trades FK into it) ----------
create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Which journal this review belongs to (per-journal isolation, cyclus 3b). Nullable
  -- + on delete set null, mirroring trades.methodology_id.
  methodology_id uuid references methodologies(id) on delete set null,
  week_nummer integer not null check (week_nummer between 1 and 53),
  jaar integer not null check (jaar between 2000 and 2100),
  titel text,
  verhalen text,
  technisch text,
  mentaal_owner text,
  mentaal_trader text,
  acties text[] not null default '{}',
  takeaway text,
  overall_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Unique per journal, not per whole account, so two journals can each hold a week-1
-- review. Partial: an unassigned (null-journal) row is never blocked (cyclus 3b).
create unique index weekly_reviews_journal_week_unique
  on weekly_reviews(user_id, methodology_id, jaar, week_nummer)
  where methodology_id is not null;

-- ---------- PERIODIC REVIEWS (month/quarter/year — no FK from trades, period found by date range) ----------
create table periodic_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Which journal this review belongs to (per-journal isolation, cyclus 3b).
  methodology_id uuid references methodologies(id) on delete set null,
  period_type period_type_enum not null,
  jaar integer not null check (jaar between 2000 and 2100),
  periode_nummer integer, -- 1-12 for month, 1-4 for quarter, null for year
  titel text,
  technisch text,
  mentaal_owner text,
  mentaal_trader text,
  acties text[] not null default '{}',
  takeaway text,
  overall_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique per journal (cyclus 3b): the same month/quarter/year review can exist
-- once per journal. Partial on methodology_id is not null so unassigned rows pass.
create unique index periodic_reviews_month_quarter_unique
  on periodic_reviews(user_id, methodology_id, period_type, jaar, periode_nummer)
  where periode_nummer is not null and methodology_id is not null;
create unique index periodic_reviews_year_unique
  on periodic_reviews(user_id, methodology_id, jaar)
  where period_type = 'year' and methodology_id is not null;

-- ---------- TRADES ----------
create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  fase fase_enum not null,
  datum_open date not null,
  datum_sluiting date,
  duur_dagen integer generated always as (datum_sluiting - datum_open) stored,

  pair pair_enum not null,
  direction direction_enum, -- Long/Short; nullable (unknown on trades logged before cyclus 5 / imports without a side)
  outcome outcome_enum not null,
  resultaat_pct numeric(7,2) not null,
  -- Planned risk % the trade was taken with. NULL = the default 1% (DEFAULT_RISK_PCT),
  -- which keeps R ≡ resultaat_pct for everyone on the flat-1% workflow. See 0012_risk_pct.sql.
  risk_pct numeric(7,2) check (risk_pct > 0),
  trade_evaluation trade_evaluation_enum,

  weekly_criteria weekly_criteria_enum,
  weekly_kenmerk weekly_kenmerk_enum,
  trade_concept text, -- fixed TRADE_CONCEPTS list + per-user custom_options, not a native enum (see custom_options below)
  entry text, -- fixed ENTRIES list + per-user custom_options, not a native enum (see custom_options below)

  cc cc_enum not null,
  -- Timezone-aware trading session, derived from cc + datum_open + the owner's
  -- profiles.timezone. Maintained by trg_trades_set_sessie (not a generated
  -- column: the tz conversion isn't IMMUTABLE). See compute_sessie() and 0019.
  sessie sessie_enum not null,

  nieuws boolean not null default false,
  w_confirm boolean,
  d_confirm boolean,
  h4_confirm boolean,
  w_screenshot text,
  d_screenshot text,
  h4_screenshot text,
  h2_screenshot text,
  extra_d_conf boolean,

  notes text,

  -- Fase 1
  fase1_daily_respecteert_zone boolean,
  fase1_spelers_verleden boolean,
  -- Fase 2
  fase2_daily_respecteert_zone boolean,
  fase2_structuur structuur_enum,
  -- Fase 3
  fase3_zone_min_2_touches boolean,
  fase3_engulfing_candle boolean,
  fase3_beide boolean generated always as (
    coalesce(fase3_zone_min_2_touches,false) and coalesce(fase3_engulfing_candle,false)
  ) stored,
  fase3_structuur structuur_enum,
  -- Fase 4
  fase4_weekly_bevestigingscandle boolean,

  weekly_review_id uuid references weekly_reviews(id) on delete set null,
  backtest_project_id uuid references backtest_projects(id) on delete cascade,

  -- Broker-import dedup reference "{broker}:{ticket}" (NULL for hand-entered
  -- trades). Makes re-importing the same export idempotent. See 0017_trade_import_ref.sql.
  import_ref text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ACCOUNTS ----------
create table prop_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Which journal this account belongs to (per-journal isolation, cyclus 3b).
  methodology_id uuid references methodologies(id) on delete set null,
  naam text not null,
  account_size numeric(12,2) not null,
  fase prop_fase_enum not null default 'Phase 1',
  actief boolean not null default true,
  current_pnl_pct numeric(6,2),
  -- Prop-firm rules (% of account size, nullable = not configured, manually entered).
  -- See migration 0013_prop_firm_rules.sql.
  profit_target_pct numeric(6,2) check (profit_target_pct > 0),
  max_drawdown_pct numeric(6,2) check (max_drawdown_pct > 0),
  daily_loss_limit_pct numeric(6,2) check (daily_loss_limit_pct > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references prop_accounts(id) on delete cascade,
  bedrag numeric(12,2) not null,
  datum date not null,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- CUSTOM OPTIONS ----------
-- Per-user extra values for a fixed-list form field (e.g. field='entry'), merged
-- client-side on top of the shared constant list — see useCustomOptions.
create table custom_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  field text not null,
  value text not null,
  created_at timestamptz not null default now(),
  unique (user_id, field, value)
);

-- ---------- CONFIGURABLE METHODOLOGY / JOURNAL (Scope C — see 0020, 0022) ----------
-- Per-user methodology definitions that replace the hard-coded FASES /
-- FASE_KENMERKEN (constants.ts). The built-in Weekly Phase Method template (user_id NULL,
-- is_system) is seeded below, world-readable and editable by no one; users own
-- and edit their own copies. Fase-kenmerken move off the fixed trades.fase*_
-- columns into the flexible trades.custom jsonb bag, shaped by the field
-- definitions here. Since 0022 a methodology also carries an asset_class +
-- instrument_config, i.e. it doubles as the user's "journal" (see design doc §3).
create table methodologies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- NULL = built-in system template
  naam text not null,
  is_system boolean not null default false,
  asset_class text,                    -- forex | futures | stock | crypto | custom (free text, no CHECK — new presets need no migration); see 0022
  instrument_config jsonb,             -- instrument universe + sizing tools per asset — populated in cyclus 7
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table methodology_fases (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references methodologies(id) on delete cascade,
  naam text not null,
  sort_order integer not null default 0,
  unique (methodology_id, naam)
);

create table methodology_fields (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references methodologies(id) on delete cascade,
  fase_id uuid references methodology_fases(id) on delete cascade, -- legacy/transitional; fase is now a field (see 0023), null on the new flat model
  field_key text not null,             -- stable key inside the trades.custom jsonb bag
  label text not null,
  field_type text not null check (field_type in ('boolean', 'enum', 'text', 'number', 'date')),
  options jsonb,                       -- enum: ordered allowed values, e.g. '["Inner","Outer"]'
  is_computed boolean not null default false, -- e.g. Fase 3 "Beide?" — derived, never stored in the bag
  group_label text,                    -- form section header (see 0022)
  required boolean not null default false,    -- mandatory on input (see 0022)
  show_when_field_id uuid references methodology_fields(id) on delete set null, -- conditional visibility (see 0022)
  show_when_values jsonb,              -- values of show_when_field_id that reveal this field
  sort_order integer not null default 0,
  unique (methodology_id, field_key) -- fase is now a field; field_key is unique per methodology (see 0023)
);

create index idx_methodology_fases_methodology on methodology_fases(methodology_id);
create index idx_methodology_fields_methodology on methodology_fields(methodology_id);

-- Seed the built-in Weekly Phase Method template (the methodology currently hard-coded in
-- constants.ts) BEFORE the profiles alter below — that alter's column default
-- points at this row, so it must exist first. Fixed id keeps references stable.
insert into methodologies (id, user_id, naam, is_system, asset_class)
values ('00000000-0000-4000-8000-000000000001', null, 'Weekly Phase Method', true, 'forex');

insert into methodology_fases (methodology_id, naam, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'Fase 1', 1),
  ('00000000-0000-4000-8000-000000000001', 'Fase 2', 2),
  ('00000000-0000-4000-8000-000000000001', 'Fase 3', 3),
  ('00000000-0000-4000-8000-000000000001', 'Fase 4', 4);

-- Fase is a field now (see 0023): a 'fase' enum field carries the fase list, and
-- the kenmerken are unified per field_key and shown conditionally via show_when.
-- (methodology_fases above is kept transitionally until the client stops reading it.)
with fase_field as (
  insert into methodology_fields
    (methodology_id, fase_id, field_key, label, field_type, options, is_computed, group_label, required, sort_order)
  values
    ('00000000-0000-4000-8000-000000000001', null, 'fase', 'Fase', 'enum',
     '["Fase 1","Fase 2","Fase 3","Fase 4"]'::jsonb, false, null, true, 1)
  returning id
)
insert into methodology_fields
  (methodology_id, fase_id, field_key, label, field_type, options, is_computed, group_label, required, show_when_field_id, show_when_values, sort_order)
select
  '00000000-0000-4000-8000-000000000001', null,
  v.field_key, v.label, v.field_type, v.options, v.is_computed, 'Kenmerken', false,
  ff.id, v.show_when, v.sort_order
from fase_field ff, (values
  ('daily_respecteert_zone',    'Daily respecteert zone?',         'boolean', null::jsonb,                false, '["Fase 1","Fase 2"]'::jsonb, 2),
  ('spelers_verleden',          'Al spelers in verleden (W)?',     'boolean', null::jsonb,                false, '["Fase 1"]'::jsonb,          3),
  ('structuur',                 'Structuur',                       'enum',    '["Inner","Outer"]'::jsonb, false, '["Fase 2","Fase 3"]'::jsonb, 4),
  ('zone_min_2_touches',        'Zone met min. 2 vorige touches?', 'boolean', null::jsonb,                false, '["Fase 3"]'::jsonb,          5),
  ('engulfing_candle',          'Engulfing candle?',               'boolean', null::jsonb,                false, '["Fase 3"]'::jsonb,          6),
  ('beide',                     'Beide?',                          'boolean', null::jsonb,                true,  '["Fase 3"]'::jsonb,          7),
  ('weekly_bevestigingscandle', 'Weekly bevestigingscandle?',      'boolean', null::jsonb,                false, '["Fase 4"]'::jsonb,          8)
) as v(field_key, label, field_type, options, is_computed, show_when, sort_order);

-- Journal-presets catalogue (Scope C, cyclus 6 — see 0027 + docs/journal-presets.md).
-- 8 is_system recipes = asset preset (instrument/sizing/asset fields) ∪ trader-style
-- preset (setup/quality/mindset/beheer fields). Picked in /settings and forked into
-- an editable own copy via fork_methodology(). Weekly Phase Method (above) is one more
-- recipe; "Blanco" is the empty own methodology handle_new_user() provisions (0025).
insert into methodologies (id, user_id, naam, is_system, asset_class, instrument_config) values
  ('00000000-0000-4000-8000-000000000010', null, 'Forex — Day trader',   true, 'forex',
     '{"unit":"lots","sizing_tools":["lot_calculator","currency_split"]}'::jsonb),
  ('00000000-0000-4000-8000-000000000011', null, 'Forex — Swing',        true, 'forex',
     '{"unit":"lots","sizing_tools":["lot_calculator","currency_split"]}'::jsonb),
  ('00000000-0000-4000-8000-000000000020', null, 'Futures — Scalper',    true, 'futures',
     '{"unit":"contracts","sizing_tools":["tick_value"],"tick_values":{"ES":12.5,"NQ":5,"YM":5,"RTY":5,"CL":10,"GC":10,"MES":1.25,"MNQ":0.5}}'::jsonb),
  ('00000000-0000-4000-8000-000000000021', null, 'Futures — Day trader', true, 'futures',
     '{"unit":"contracts","sizing_tools":["tick_value"],"tick_values":{"ES":12.5,"NQ":5,"YM":5,"RTY":5,"CL":10,"GC":10,"MES":1.25,"MNQ":0.5}}'::jsonb),
  ('00000000-0000-4000-8000-000000000030', null, 'Stocks — Day trader',  true, 'stock',
     '{"unit":"shares"}'::jsonb),
  ('00000000-0000-4000-8000-000000000031', null, 'Stocks — Swing',       true, 'stock',
     '{"unit":"shares"}'::jsonb),
  ('00000000-0000-4000-8000-000000000040', null, 'Crypto — Day trader',  true, 'crypto',
     '{"unit":"coins","note":"24/7"}'::jsonb),
  ('00000000-0000-4000-8000-000000000041', null, 'Crypto — Swing',       true, 'crypto',
     '{"unit":"coins","note":"24/7"}'::jsonb),
  ('00000000-0000-4000-8000-000000000012', null, 'Forex — Scalper',      true, 'forex',
     '{"unit":"lots","sizing_tools":["lot_calculator","currency_split"]}'::jsonb),
  ('00000000-0000-4000-8000-000000000042', null, 'Crypto — Scalper',     true, 'crypto',
     '{"unit":"coins","note":"24/7"}'::jsonb);

insert into methodology_fields
  (methodology_id, fase_id, field_key, label, field_type, options, is_computed, group_label, required, show_when_values, sort_order)
select
  v.methodology_id::uuid, null, v.field_key, v.label, v.field_type, v.options, false, v.group_label, false, v.show_when_values, v.sort_order
from (values
  ('00000000-0000-4000-8000-000000000010','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000010','timeframe','Timeframe','enum','["1m","5m","15m","1H"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000010','market_condition','Marktconditie','enum','["Trending","Ranging","Volatiel/nieuws"]'::jsonb,'Setup',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000010','quality','Setup-kwaliteit','enum','["A+","B","C","Off-plan"]'::jsonb,'Setup',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000010','session','Sessie','enum','["Asia","London","New York","Overlap"]'::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000010','news','High-impact nieuws?','boolean',null::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000010','mistake','Fout','enum','["Geen","FOMO","Revenge","Oversized","Chased","Te vroeg","Te laat"]'::jsonb,'Mindset',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000010','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,8),

  ('00000000-0000-4000-8000-000000000011','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000011','timeframe','Timeframe','enum','["1H","4H","Daily"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000011','session','Sessie','enum','["Asia","London","New York","Overlap"]'::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000011','news','High-impact nieuws?','boolean',null::jsonb,'Markt',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000011','market_regime','Marktregime','enum','["Bull","Bear","Sideways"]'::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000011','targets','Targets (R)','text',null::jsonb,'Beheer',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000011','catalyst','Katalysator','text',null::jsonb,'Beheer',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000011','management_notes','Beheer-notities','text',null::jsonb,'Beheer',null::jsonb,8),

  ('00000000-0000-4000-8000-000000000020','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000020','timeframe','Timeframe','enum','["1m","3m","5m"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000020','contracts','Aantal contracten','number',null::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000020','contract_type','Contracttype','enum','["Standard","Micro"]'::jsonb,'Markt',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000020','contract_month','Contractmaand','text',null::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000020','hours','Handelsuren','enum','["RTH","ETH"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000020','session','Sessie','enum','["Pre-market","Regular","Overnight"]'::jsonb,'Markt',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000020','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,8),

  ('00000000-0000-4000-8000-000000000021','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000021','timeframe','Timeframe','enum','["1m","5m","15m","1H"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000021','market_condition','Marktconditie','enum','["Trending","Ranging","Volatiel/nieuws"]'::jsonb,'Setup',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000021','quality','Setup-kwaliteit','enum','["A+","B","C","Off-plan"]'::jsonb,'Setup',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000021','contracts','Aantal contracten','number',null::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000021','contract_type','Contracttype','enum','["Standard","Micro"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000021','contract_month','Contractmaand','text',null::jsonb,'Markt',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000021','hours','Handelsuren','enum','["RTH","ETH"]'::jsonb,'Markt',null::jsonb,8),
  ('00000000-0000-4000-8000-000000000021','session','Sessie','enum','["Pre-market","Regular","Overnight"]'::jsonb,'Markt',null::jsonb,9),
  ('00000000-0000-4000-8000-000000000021','mistake','Fout','enum','["Geen","FOMO","Revenge","Oversized","Chased","Te vroeg","Te laat"]'::jsonb,'Mindset',null::jsonb,10),
  ('00000000-0000-4000-8000-000000000021','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,11),

  ('00000000-0000-4000-8000-000000000030','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000030','timeframe','Timeframe','enum','["1m","5m","15m","1H"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000030','market_condition','Marktconditie','enum','["Trending","Ranging","Volatiel/nieuws"]'::jsonb,'Setup',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000030','quality','Setup-kwaliteit','enum','["A+","B","C","Off-plan"]'::jsonb,'Setup',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000030','sector','Sector','enum','["Tech","Healthcare","Financials","Energy","Consumer","Industrials","Materials","Utilities","Real Estate","Communications"]'::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000030','market_cap','Market cap','enum','["Large","Mid","Small","Micro"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000030','float','Float','enum','["Laag","Middel","Hoog"]'::jsonb,'Markt',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000030','catalyst','Katalysator','enum','["Earnings","FDA","Up/downgrade","Sectornieuws","Gap","Breakout","M&A","Geen"]'::jsonb,'Markt',null::jsonb,8),
  ('00000000-0000-4000-8000-000000000030','session','Sessie','enum','["Pre-market","Regular","After-hours"]'::jsonb,'Markt',null::jsonb,9),
  ('00000000-0000-4000-8000-000000000030','mistake','Fout','enum','["Geen","FOMO","Revenge","Oversized","Chased","Te vroeg","Te laat"]'::jsonb,'Mindset',null::jsonb,10),
  ('00000000-0000-4000-8000-000000000030','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,11),

  ('00000000-0000-4000-8000-000000000031','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000031','timeframe','Timeframe','enum','["1H","4H","Daily"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000031','sector','Sector','enum','["Tech","Healthcare","Financials","Energy","Consumer","Industrials","Materials","Utilities","Real Estate","Communications"]'::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000031','market_cap','Market cap','enum','["Large","Mid","Small","Micro"]'::jsonb,'Markt',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000031','float','Float','enum','["Laag","Middel","Hoog"]'::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000031','catalyst','Katalysator','enum','["Earnings","FDA","Up/downgrade","Sectornieuws","Gap","Breakout","M&A","Geen"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000031','session','Sessie','enum','["Pre-market","Regular","After-hours"]'::jsonb,'Markt',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000031','market_regime','Marktregime','enum','["Bull","Bear","Sideways"]'::jsonb,'Markt',null::jsonb,8),
  ('00000000-0000-4000-8000-000000000031','targets','Targets (R)','text',null::jsonb,'Beheer',null::jsonb,9),
  ('00000000-0000-4000-8000-000000000031','management_notes','Beheer-notities','text',null::jsonb,'Beheer',null::jsonb,10),

  ('00000000-0000-4000-8000-000000000040','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000040','timeframe','Timeframe','enum','["1m","5m","15m","1H"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000040','market_condition','Marktconditie','enum','["Trending","Ranging","Volatiel/nieuws"]'::jsonb,'Setup',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000040','quality','Setup-kwaliteit','enum','["A+","B","C","Off-plan"]'::jsonb,'Setup',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000040','market_type','Markttype','enum','["Spot","Perpetual","Futures"]'::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000040','leverage','Hefboom (x)','number',null::jsonb,'Markt','["Perpetual","Futures"]'::jsonb,6),
  ('00000000-0000-4000-8000-000000000040','funding_rate','Funding rate %','number',null::jsonb,'Markt','["Perpetual"]'::jsonb,7),
  ('00000000-0000-4000-8000-000000000040','session_utc','Sessie (UTC)','enum','["Asia","Europe","US"]'::jsonb,'Markt',null::jsonb,8),
  ('00000000-0000-4000-8000-000000000040','mistake','Fout','enum','["Geen","FOMO","Revenge","Oversized","Chased","Te vroeg","Te laat"]'::jsonb,'Mindset',null::jsonb,9),
  ('00000000-0000-4000-8000-000000000040','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,10),

  ('00000000-0000-4000-8000-000000000041','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000041','timeframe','Timeframe','enum','["1H","4H","Daily"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000041','market_type','Markttype','enum','["Spot","Perpetual","Futures"]'::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000041','leverage','Hefboom (x)','number',null::jsonb,'Markt','["Perpetual","Futures"]'::jsonb,4),
  ('00000000-0000-4000-8000-000000000041','funding_rate','Funding rate %','number',null::jsonb,'Markt','["Perpetual"]'::jsonb,5),
  ('00000000-0000-4000-8000-000000000041','session_utc','Sessie (UTC)','enum','["Asia","Europe","US"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000041','market_regime','Marktregime','enum','["Bull","Bear","Sideways"]'::jsonb,'Markt',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000041','targets','Targets (R)','text',null::jsonb,'Beheer',null::jsonb,8),
  ('00000000-0000-4000-8000-000000000041','catalyst','Katalysator','text',null::jsonb,'Beheer',null::jsonb,9),
  ('00000000-0000-4000-8000-000000000041','management_notes','Beheer-notities','text',null::jsonb,'Beheer',null::jsonb,10),

  ('00000000-0000-4000-8000-000000000012','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000012','timeframe','Timeframe','enum','["1m","3m","5m"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000012','session','Sessie','enum','["Asia","London","New York","Overlap"]'::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000012','news','High-impact nieuws?','boolean',null::jsonb,'Markt',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000012','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,5),

  ('00000000-0000-4000-8000-000000000042','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000042','timeframe','Timeframe','enum','["1m","3m","5m"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000042','market_type','Markttype','enum','["Spot","Perpetual","Futures"]'::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000042','leverage','Hefboom (x)','number',null::jsonb,'Markt','["Perpetual","Futures"]'::jsonb,4),
  ('00000000-0000-4000-8000-000000000042','funding_rate','Funding rate %','number',null::jsonb,'Markt','["Perpetual"]'::jsonb,5),
  ('00000000-0000-4000-8000-000000000042','session_utc','Sessie (UTC)','enum','["Asia","Europe","US"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000042','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,7)
) as v(methodology_id, field_key, label, field_type, options, group_label, show_when_values, sort_order);

-- Crypto conditional visibility: leverage/funding_rate shown by market_type (see 0027).
update methodology_fields child
set show_when_field_id = parent.id
from methodology_fields parent
where parent.methodology_id = child.methodology_id
  and parent.field_key = 'market_type'
  and child.field_key in ('leverage', 'funding_rate')
  and child.methodology_id in (
    '00000000-0000-4000-8000-000000000040',
    '00000000-0000-4000-8000-000000000041',
    '00000000-0000-4000-8000-000000000042'
  );

-- New methodology columns on trades/profiles (see 0020). Added via alter so the
-- methodologies table (created here, after trades/profiles above) is referenceable.
alter table trades add column methodology_id uuid references methodologies(id) on delete set null;
alter table trades add column custom jsonb not null default '{}'::jsonb; -- flexible per-trade custom-field bag (was `kenmerken`, renamed in 0022)
-- No column default: new users are provisioned an own empty journal by
-- handle_new_user() (see 0025), not silently handed the Weekly Phase Method template.
alter table profiles add column methodology_id uuid references methodologies(id) on delete set null;

-- ---------- INDEXES ----------
create index idx_trades_user on trades(user_id);
create index idx_trades_datum_open on trades(datum_open);
create index idx_trades_fase on trades(fase);
create index idx_trades_methodology on trades(methodology_id);
create index idx_trades_pair on trades(pair);
create index idx_trades_weekly_review on trades(weekly_review_id);
create index idx_trades_backtest_project on trades(backtest_project_id);
create unique index trades_user_import_ref_unique on trades(user_id, import_ref) where import_ref is not null;
create index idx_payouts_account on payouts(account_id);
create index idx_periodic_reviews_user on periodic_reviews(user_id);
-- Per-journal isolation (cyclus 3b).
create index idx_weekly_reviews_methodology on weekly_reviews(methodology_id);
create index idx_periodic_reviews_methodology on periodic_reviews(methodology_id);
create index idx_prop_accounts_methodology on prop_accounts(methodology_id);

-- ---------- updated_at TRIGGERS ----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_trades_updated_at before update on trades
  for each row execute function set_updated_at();
create trigger trg_weekly_reviews_updated_at before update on weekly_reviews
  for each row execute function set_updated_at();
create trigger trg_prop_accounts_updated_at before update on prop_accounts
  for each row execute function set_updated_at();
create trigger trg_backtest_projects_updated_at before update on backtest_projects
  for each row execute function set_updated_at();
create trigger trg_periodic_reviews_updated_at before update on periodic_reviews
  for each row execute function set_updated_at();
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_methodologies_updated_at before update on methodologies
  for each row execute function set_updated_at();

-- ---------- timezone-aware trading session mapping (see 0019) ----------
-- (cc, date, tz) -> session, anchored to the reference zone the methodology was
-- authored in (Europe/Brussels). STABLE (depends on the tz database), so it can't
-- live in a generated column — a trigger maintains trades.sessie instead.
create or replace function compute_sessie(p_cc cc_enum, p_datum date, p_tz text)
returns sessie_enum
language plpgsql
stable
as $$
declare
  brussels_hour int;
begin
  if p_cc is null or p_datum is null then
    return null;
  end if;

  brussels_hour := extract(
    hour from
      ((p_datum::timestamp + make_interval(hours => p_cc::text::int))
        at time zone coalesce(p_tz, 'Europe/Brussels'))
        at time zone 'Europe/Brussels'
  )::int;

  return case
    when brussels_hour between 0 and 7  then 'Asia'::sessie_enum
    when brussels_hour between 8 and 15 then 'London'::sessie_enum
    when brussels_hour between 16 and 19 then 'Overlap'::sessie_enum
    else 'New York'::sessie_enum
  end;
end;
$$;

create or replace function trades_set_sessie() returns trigger
language plpgsql as $$
declare
  v_tz text;
begin
  select timezone into v_tz from profiles where id = new.user_id;
  new.sessie := compute_sessie(new.cc, new.datum_open, coalesce(v_tz, 'Europe/Brussels'));
  return new;
end;
$$;

create trigger trg_trades_set_sessie
  before insert or update of cc, datum_open on trades
  for each row execute function trades_set_sessie();

-- Re-bucket a user's trades when they change their timezone.
create or replace function profiles_recompute_sessie() returns trigger
language plpgsql as $$
begin
  if new.timezone is distinct from old.timezone then
    update trades set sessie = compute_sessie(cc, datum_open, new.timezone)
    where user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_recompute_sessie
  after update of timezone on profiles
  for each row execute function profiles_recompute_sessie();

-- ---------- auto-provision profiles row on new auth.users signup ----------
-- SECURITY DEFINER: the client's JWT has no insert rights on auth.users or a
-- brand-new profiles row at signup time, so this runs with elevated
-- privileges, scoped tightly to just these inserts.
-- Each new user also gets their own EMPTY journal (methodology) — the Weekly Phase Method
-- template is a preset, never imposed on new signups (see 0025, Scope C plak 3).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_meth uuid;
begin
  insert into public.methodologies (user_id, naam, is_system, asset_class)
  values (new.id, 'Mijn journal', false, null)
  returning id into new_meth;

  insert into public.profiles (id, email, display_name, methodology_id)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name', new_meth);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- self-service account deletion (GDPR right to erasure) ----------
-- SECURITY DEFINER: the client's JWT has no delete rights on auth.users. This
-- only ever deletes the caller's own row (auth.uid(), never a parameter) —
-- every other table cascades away via its `on delete cascade` FK to
-- auth.users(id), so nothing else needs to be touched here.
create or replace function delete_own_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function delete_own_account() from public;
grant execute on function delete_own_account() to authenticated;

-- ---------- admin read-only access (debugging, future coaching foundation) ----------
-- SECURITY DEFINER for the same reason as delete_own_account() above: the
-- calling client can't safely read another admin-check row without RLS
-- recursion, so this runs with elevated privileges scoped to a single
-- boolean read. Used only to grant additional SELECT-only RLS policies
-- below — never write access.
create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

revoke all on function is_admin() from public;
grant execute on function is_admin() to authenticated;

-- ---------- per-project trade summaries (Fase 2, server-side aggregation) ----------
-- One aggregated row per backtest project instead of shipping every project
-- trade to the client for the projects-list summary cards. Mirrors
-- computeOutcomeCounts() in src/lib/stats/core.ts; excludes missed trades to
-- honour the shared missed-trade contract server-side. SECURITY INVOKER (default)
-- so RLS applies; the explicit user_id filter also blocks the admin read-all
-- policy from summing other users' projects. See 0016_project_trade_summaries.sql.
create or replace function get_project_trade_summaries()
returns table (
  backtest_project_id uuid,
  n integer,
  wins integer,
  losses integer,
  be integer,
  resultaat_total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.backtest_project_id,
    count(*)::int,
    count(*) filter (where t.outcome = 'Win')::int,
    count(*) filter (where t.outcome = 'Loss')::int,
    count(*) filter (where t.outcome = 'BE')::int,
    round(coalesce(sum(t.resultaat_pct), 0), 2)
  from trades t
  where t.backtest_project_id is not null
    and t.user_id = auth.uid()
    and t.trade_evaluation is distinct from 'Missed trade'
  group by t.backtest_project_id;
$$;

revoke all on function get_project_trade_summaries() from public;
grant execute on function get_project_trade_summaries() to authenticated;

-- ---------- fork_methodology (Scope C, cyclus 2 — see 0024) ----------
-- Fork-on-edit: copy a (system) methodology + its fields into the caller's own,
-- editable copy, remapping the self-referential show_when_field_id by field_key.
create or replace function fork_methodology(source_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into methodologies (user_id, naam, is_system, asset_class, instrument_config)
  select auth.uid(), naam, false, asset_class, instrument_config
  from methodologies where id = source_id
  returning id into new_id;

  if new_id is null then
    raise exception 'source methodology % not found or not visible', source_id;
  end if;

  insert into methodology_fields
    (methodology_id, fase_id, field_key, label, field_type, options, is_computed,
     group_label, required, show_when_values, sort_order)
  select new_id, null, field_key, label, field_type, options, is_computed,
         group_label, required, show_when_values, sort_order
  from methodology_fields where methodology_id = source_id;

  update methodology_fields nf
  set show_when_field_id = np.id
  from methodology_fields sf
  join methodology_fields sp on sp.id = sf.show_when_field_id
  join methodology_fields np on np.methodology_id = new_id and np.field_key = sp.field_key
  where sf.methodology_id = source_id
    and nf.methodology_id = new_id
    and nf.field_key = sf.field_key;

  return new_id;
end;
$$;

revoke all on function fork_methodology(uuid) from public;
grant execute on function fork_methodology(uuid) to authenticated;

-- ---------- auto-link trade <-> weekly_review ----------
-- Two BEFORE/AFTER INSERT triggers keep the link in sync in both directions:
--   * new trade  -> find existing review for its ISO week (below)
--   * new review -> backfill existing live trades of that week (further down)
-- (edited a trade's date into another week? the link is only refreshed by the
--  manual relink action in-app — see linkTradesToReview in useWeeklyReviews.ts)
create or replace function link_trade_to_weekly_review() returns trigger as $$
declare
  iso_year int;
  iso_week int;
  found_id uuid;
begin
  -- backtest_project_id is not null => project trade, never belongs to a weekly review
  if new.weekly_review_id is null and new.backtest_project_id is null then
    iso_year := extract(isoyear from new.datum_open);
    iso_week := extract(week from new.datum_open);
    select id into found_id from weekly_reviews
      where user_id = new.user_id
        and methodology_id is not distinct from new.methodology_id
        and jaar = iso_year and week_nummer = iso_week
      limit 1;
    new.weekly_review_id := found_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_link_trade_weekly_review
  before insert on trades
  for each row execute function link_trade_to_weekly_review();

-- reverse direction: a review created after its week's trades already exist
-- backfills those live trades, so it isn't limited to the insert-time link above.
create or replace function link_weekly_review_to_trades() returns trigger as $$
begin
  update trades
    set weekly_review_id = new.id
    where user_id = new.user_id
      and backtest_project_id is null
      and methodology_id is not distinct from new.methodology_id
      and weekly_review_id is null
      and extract(isoyear from datum_open) = new.jaar
      and extract(week from datum_open) = new.week_nummer;
  return new;
end;
$$ language plpgsql;

create trigger trg_link_weekly_review_trades
  after insert on weekly_reviews
  for each row execute function link_weekly_review_to_trades();

-- ---------- RLS ----------
alter table trades enable row level security;
alter table weekly_reviews enable row level security;
alter table prop_accounts enable row level security;
alter table payouts enable row level security;
alter table backtest_projects enable row level security;
alter table periodic_reviews enable row level security;
alter table profiles enable row level security;
alter table custom_options enable row level security;
alter table methodologies enable row level security;
alter table methodology_fases enable row level security;
alter table methodology_fields enable row level security;

-- No insert/delete policy for profiles: rows are created only by the
-- handle_new_user() trigger above and removed via the auth.users FK cascade.
create policy "profiles_owner_select" on profiles
  for select using (id = auth.uid());
create policy "profiles_owner_update" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "custom_options_owner_all" on custom_options
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Methodologies: built-in system templates are world-readable; users fully
-- manage their own. Child rows follow the visibility of their parent methodology.
create policy "methodologies_system_select" on methodologies
  for select using (is_system and user_id is null);
create policy "methodologies_owner_all" on methodologies
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "methodology_fases_select" on methodology_fases
  for select using (exists (
    select 1 from methodologies m where m.id = methodology_fases.methodology_id
      and (m.user_id = auth.uid() or (m.is_system and m.user_id is null))));
create policy "methodology_fases_write" on methodology_fases
  for all using (exists (
    select 1 from methodologies m where m.id = methodology_fases.methodology_id and m.user_id = auth.uid()))
  with check (exists (
    select 1 from methodologies m where m.id = methodology_fases.methodology_id and m.user_id = auth.uid()));

create policy "methodology_fields_select" on methodology_fields
  for select using (exists (
    select 1 from methodologies m where m.id = methodology_fields.methodology_id
      and (m.user_id = auth.uid() or (m.is_system and m.user_id is null))));
create policy "methodology_fields_write" on methodology_fields
  for all using (exists (
    select 1 from methodologies m where m.id = methodology_fields.methodology_id and m.user_id = auth.uid()))
  with check (exists (
    select 1 from methodologies m where m.id = methodology_fields.methodology_id and m.user_id = auth.uid()));

create policy "trades_owner_all" on trades
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weekly_reviews_owner_all" on weekly_reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "periodic_reviews_owner_all" on periodic_reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "backtest_projects_owner_all" on backtest_projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "prop_accounts_owner_all" on prop_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "payouts_owner_all" on payouts
  for all using (exists (select 1 from prop_accounts pa where pa.id = payouts.account_id and pa.user_id = auth.uid()))
  with check (exists (select 1 from prop_accounts pa where pa.id = payouts.account_id and pa.user_id = auth.uid()));

-- Admin read-only carve-out: additive permissive SELECT policies (Postgres
-- ORs multiple permissive policies together), so every owner policy above
-- is untouched — admins simply gain read access on top.
create policy "profiles_admin_select" on profiles
  for select using (is_admin());
create policy "trades_admin_select" on trades
  for select using (is_admin());
create policy "weekly_reviews_admin_select" on weekly_reviews
  for select using (is_admin());
create policy "periodic_reviews_admin_select" on periodic_reviews
  for select using (is_admin());
create policy "backtest_projects_admin_select" on backtest_projects
  for select using (is_admin());
create policy "prop_accounts_admin_select" on prop_accounts
  for select using (is_admin());
create policy "payouts_admin_select" on payouts
  for select using (is_admin());
