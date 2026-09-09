-- =========================================================
-- Beyen Invest — Supabase schema
-- Paste into Supabase SQL editor and run once (fresh project).
--
-- Dit bestand is de EINDSTAND van migraties 0001 t/m 0057 (gesynct in fixplan
-- blok C, 2026-09-09). ⚠️ CONVENTIE (hard sinds het fixplan): elke migratie die
-- een tabel/kolom/functie/policy/index wijzigt, werkt dít bestand in dezelfde
-- commit bij. Migratienummers nooit hergebruiken. (Historische voetnoot: 0020
-- bestaat dubbel — twee bestanden, beide gedraaid; 0034 bestaat niet.)
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
-- Weergave-eenheid voor resultaten (Fase J / 0037) — puur een display-voorkeur,
-- alle opslag en stats blijven in % (resultaat_pct).
create type result_unit_enum as enum ('percent','R','currency');

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
  -- Soft-launch gate (0033): shows the multi-journal UI (switcher, preset-picker,
  -- veld-editor, direction) only to flagged users. SQL-only, no UI toggle.
  beta_features boolean not null default false,
  -- IANA timezone the user reads candle-close (cc) times in. Drives the
  -- timezone-aware `trades.sessie` mapping (see compute_sessie / 0019). Default
  -- is the reference zone the methodology was authored in.
  timezone text not null default 'Europe/Brussels',
  -- Hoe resultaten getoond worden: %, R of geld (Fase J / 0037). Display-only —
  -- conversie gebeurt in de frontend, stats rekenen altijd in %.
  result_unit result_unit_enum not null default 'percent',
  -- First-run onboarding marker (Fase N4 / 0041). NULL = wizard not yet completed;
  -- stamped now() when the user finishes/skips it. Beta-gated in the UI.
  onboarded_at timestamptz,
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
  -- + on delete set null, mirroring trades.methodology_id. The FK constraint is
  -- added AFTER the methodologies block below (fresh-bootstrap order, fixplan C1/W1)
  -- — an inline REFERENCES here would fail: methodologies doesn't exist yet.
  methodology_id uuid,
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
  -- Values of this journal's *custom* review sections (Fase N5, 0048), keyed by
  -- section_key — mirrors trades.custom. Built-in sections keep their own columns
  -- above; only user-added sections land here. {} = the built-in default set.
  content jsonb not null default '{}'::jsonb,
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
  -- FK added after the methodologies block (see weekly_reviews).
  methodology_id uuid,
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
  -- Vrije sub-periode-recap (maanden binnen een kwartaal, kwartalen binnen een
  -- jaar — zie 0007). get_shared_review selecteert deze kolom, dus zonder haar
  -- faalt élke periodieke review-save én de review-share op een verse install.
  periode_overzicht text,
  -- Custom review-section values (Fase N5, 0048) — see weekly_reviews.content.
  content jsonb not null default '{}'::jsonb,
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

-- ---------- TRADE CONTRACTS (owner-only pre-trade commitment, 0053) ----------
-- A short contract the trader signs BEFORE a trade (keystone-check, fase,
-- instrument, risk, news window, signature), later closed with the outcome in R
-- + whether the process was respected — or logged as a deliberately missed
-- setup. Owner-only in the UI (betaFeatures gate), but per-user + per-journal in
-- the DB just like the review tables. No money/P&L is ever stored (outcome is an
-- R-multiple only). No updated_at: signed once, closed once.
create table trade_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- FK added after the methodologies block (see weekly_reviews).
  methodology_id uuid,
  created_at timestamptz not null default now(),
  signed_at timestamptz,
  instrument text,
  fase text,
  entry_type text,
  risk_pct numeric,
  signature text,
  status text not null default 'open' check (status in ('open', 'closed', 'missed')),
  outcome_r numeric,
  proces_goed boolean,
  note text
);
create index idx_trade_contracts_user on trade_contracts(user_id);
create index idx_trade_contracts_methodology on trade_contracts(methodology_id);

-- ---------- HABITS (0054 + 0056 — performance-laag naast het journal) ----------
-- Life-level, deliberately GLOBAL per user (no methodology_id): habits and the
-- daily journal below belong to the person, not to whichever trading book is
-- active. A conscious exception to the per-journal isolation of trades/reviews.
-- User-built habit definitions (0056). habit_days.values stays keyed by `key`,
-- so tick history survives edits; new users get no rows → a blank builder page.
-- (The 0056 seed for pre-existing habit_days users is prod-only backfill — a
-- fresh install has no habit_days and seeds nothing.)
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Stable identifier stored in habit_days.values; unique per user.
  key text not null,
  label text not null,
  tier text not null check (tier in ('daily', 'weekly')),
  target integer check (target is null or target > 0), -- only meaningful for weekly
  is_floor boolean not null default false,             -- part of the daily non-negotiable floor
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
create index idx_habits_user_order on habits(user_id, sort_order);

-- One row per (user, day) holds the habits completed that day: `{ [habitKey]: true }`.
-- No updated_at (the row is upserted in place per day) → no set_updated_at trigger.
create table habit_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
create index idx_habit_days_user_day on habit_days(user_id, day);

-- ---------- DAILY JOURNAL / DAGBOEK (0055) ----------
-- A short free-text note per calendar day, next to the Habits tracker. Global
-- per user (see the habits comment above). One note per day, edited in place.
create table daily_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index daily_journal_entries_user_date_unique
  on daily_journal_entries(user_id, entry_date);
-- List/browse is always "my entries, newest day first".
create index idx_daily_journal_entries_user_date
  on daily_journal_entries(user_id, entry_date desc);

-- ---------- TRADES ----------
create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  fase fase_enum not null,
  datum_open date not null,
  -- Real open time next to the date (Fase S2, 0051) — wall-clock in the owner's
  -- own profiles.timezone, exactly as typed (naive on purpose, like datum_open
  -- and cc). Nullable: null = time unknown (pre-0051 rows, quick-log, imports),
  -- the trade then sits out the time-based session/hour breakdowns.
  tijd_open time,
  datum_sluiting date,
  duur_dagen integer generated always as (datum_sluiting - datum_open) stored,

  pair pair_enum not null,
  -- Free instrument symbol — the universal "what did you trade" for any asset class
  -- (cyclus 7). Forex journals mirror instrument = pair; other journals write their
  -- own ticker/coin and leave pair on a default. See 0032.
  instrument text,
  direction direction_enum, -- Long/Short; nullable (unknown on trades logged before cyclus 5 / imports without a side)
  -- A running trade (is_open = true) has no realized result yet — outcome/resultaat_pct
  -- stay null until it's closed. Excluded from every realized number app-side via
  -- closedTrades() (same contract as missed trades). See 0043_open_trades.sql.
  is_open boolean not null default false,
  outcome outcome_enum, -- null only while is_open (see trades_open_result_chk)
  resultaat_pct numeric(7,2), -- null only while is_open (see trades_open_result_chk)
  -- Closed ⇒ must have a result; open ⇒ must not carry one (kept clean, not stale).
  constraint trades_open_result_chk check (
    (is_open and outcome is null and resultaat_pct is null)
    or (not is_open and outcome is not null and resultaat_pct is not null)
  ),
  -- An open trade carries no execution grade yet, and can never be a "Missed trade"
  -- (a setup you didn't take is the opposite of a live position still running).
  constraint trades_open_no_eval_chk check (not is_open or trade_evaluation is null),
  -- Planned risk % the trade was taken with. NULL = the default 1% (DEFAULT_RISK_PCT),
  -- which keeps R ≡ resultaat_pct for everyone on the flat-1% workflow. See 0012_risk_pct.sql.
  risk_pct numeric(7,2) check (risk_pct > 0),
  trade_evaluation trade_evaluation_enum,

  -- Exit-analyse (Fase N3, 0049) — optional, hand-entered. MAE/MFE are POSITIVE
  -- magnitudes in the same unit as resultaat_pct (% of account): the worst
  -- unrealized drawdown resp. best unrealized profit the trade saw before close.
  -- planned_rr is the reward:risk multiple planned at entry (e.g. 3 = 3R target).
  mae_pct numeric(7,2) check (mae_pct >= 0),
  mfe_pct numeric(7,2) check (mfe_pct >= 0),
  planned_rr numeric(7,2) check (planned_rr > 0),
  -- Final excursions only exist for a finished trade — mirror of trades_open_no_eval_chk.
  -- (planned_rr may be set while open: it's the plan made at entry.)
  constraint trades_open_no_excursion_chk check (
    not is_open or (mae_pct is null and mfe_pct is null)
  ),

  weekly_criteria weekly_criteria_enum,
  weekly_kenmerk weekly_kenmerk_enum,
  trade_concept text, -- fixed TRADE_CONCEPTS list + per-user custom_options, not a native enum (see custom_options below)
  entry text, -- fixed ENTRIES list + per-user custom_options, not a native enum (see custom_options below)

  cc cc_enum not null,
  -- Timezone-aware trading session, derived from the owner's profiles.timezone
  -- plus the real open time (tijd_open, 0051) when present, else the legacy cc
  -- slot (0019). Maintained by trg_trades_set_sessie (not a generated column:
  -- the tz conversion isn't IMMUTABLE). See compute_sessie()/compute_sessie_at().
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
  -- FK added after the methodologies block (see weekly_reviews).
  methodology_id uuid,
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
  -- Per-journal opt-in for the advanced-analysis layer (0050): planned R:R + MAE/MFE
  -- form fields, the exit-analysis view and the SQN KPI. Default off; toggled in the
  -- journal builder / methodology editor. Keeps the default form + KPI row clean.
  track_exit boolean not null default false,
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
  label_key text,                      -- catalogue block key for render-time label translation; null = custom field (see 0047)
  field_type text not null check (field_type in ('boolean', 'enum', 'text', 'number', 'date')),
  options jsonb,                       -- enum: ordered allowed values, e.g. '["Inner","Outer"]'
  is_computed boolean not null default false, -- e.g. Fase 3 "Beide?" — derived, never stored in the bag
  group_label text,                    -- form section header (see 0022)
  group_key text,                      -- catalogue group key, group_label's counterpart of label_key (see 0047)
  required boolean not null default false,    -- mandatory on input (see 0022)
  show_when_field_id uuid references methodology_fields(id) on delete set null, -- conditional visibility (see 0022)
  show_when_values jsonb,              -- values of show_when_field_id that reveal this field
  sort_order integer not null default 0,
  unique (methodology_id, field_key) -- fase is now a field; field_key is unique per methodology (see 0023)
);

create index idx_methodology_fases_methodology on methodology_fases(methodology_id);
create index idx_methodology_fields_methodology on methodology_fields(methodology_id);

-- ---------- CONFIGURABLE REVIEW SECTIONS (Fase N5 — see 0048) ----------
-- Per-journal, per-review-kind (weekly/periodic) ordered list of review sections,
-- the review-side counterpart of methodology_fields. No rows for a kind ⇒ the
-- client falls back to the built-in default set (src/lib/reviewSections.ts); any
-- rows fully replace the defaults. A built-in section_key (verhalen/technisch/…)
-- reads/writes its own review column; any other key stores its value in the
-- review's content jsonb bag.
create table review_sections (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references methodologies(id) on delete cascade,
  review_kind text not null check (review_kind in ('weekly', 'periodic')),
  section_key text not null,
  label text not null,
  label_key text,              -- catalogue key for render-time label translation (0047-style); null = custom section
  input_type text not null check (input_type in ('text', 'list')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (methodology_id, review_kind, section_key)
);

create index idx_review_sections_methodology on review_sections(methodology_id);

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

-- Render-time label translation backfill (0047 §3/§4, fixplan C1/W10): the seed
-- VALUES above don't carry label_key/group_key, so stamp them here for every
-- field whose frozen label exactly matches a catalogue label — otherwise a fresh
-- install shows frozen NL labels in the EN UI (share view, preset preview).
-- Idempotent and catalogue-matches only, verbatim from 0047.
update methodology_fields f
set label_key = f.field_key
from (values
  ('setup',            'Setup'),
  ('timeframe',        'Timeframe'),
  ('market_condition', 'Marktconditie'),
  ('market_condition', 'Market condition'),
  ('quality',          'Setup-kwaliteit'),
  ('quality',          'Setup quality'),
  ('direction_note',   'Richting'),
  ('direction_note',   'Direction'),
  ('session',          'Sessie'),
  ('session',          'Session'),
  ('news',             'High-impact nieuws?'),
  ('news',             'High-impact news?'),
  ('sector',           'Sector'),
  ('market_cap',       'Market cap'),
  ('catalyst',         'Katalysator'),
  ('catalyst',         'Catalyst'),
  ('contracts',        'Aantal contracten'),
  ('contracts',        'Contracts'),
  ('contract_type',    'Contracttype'),
  ('contract_type',    'Contract type'),
  ('hours',            'Handelsuren'),
  ('hours',            'Trading hours'),
  ('market_type',      'Markttype'),
  ('market_type',      'Market type'),
  ('leverage',         'Hefboom (x)'),
  ('leverage',         'Leverage (x)'),
  ('market_regime',    'Marktregime'),
  ('market_regime',    'Market regime'),
  ('targets',          'Targets (R)'),
  ('emotion',          'Emotie'),
  ('emotion',          'Emotion'),
  ('mistake',          'Fout'),
  ('mistake',          'Mistake'),
  ('followed_plan',    'Volgde ik mijn plan?'),
  ('followed_plan',    'Did I follow my plan?')
) as k(field_key, written_label)
where f.label_key is null
  and f.field_key = k.field_key
  and f.label = k.written_label;

update methodology_fields
set group_key = case
  when group_label in ('Setup & uitvoering', 'Setup & execution', 'Setup') then 'setup'
  when group_label in ('Markt', 'Market') then 'markt'
  when group_label in ('Mindset & discipline', 'Mindset') then 'mindset'
end
where group_key is null
  and group_label in ('Setup & uitvoering', 'Setup & execution', 'Setup',
                      'Markt', 'Market', 'Mindset & discipline', 'Mindset');

-- New methodology columns on trades/profiles (see 0020). Added via alter so the
-- methodologies table (created here, after trades/profiles above) is referenceable.
alter table trades add column methodology_id uuid references methodologies(id) on delete set null;
alter table trades add column custom jsonb not null default '{}'::jsonb; -- flexible per-trade custom-field bag (was `kenmerken`, renamed in 0022)
-- No column default: new users are provisioned an own empty journal by
-- handle_new_user() (see 0025), not silently handed the Weekly Phase Method template.
alter table profiles add column methodology_id uuid references methodologies(id) on delete set null;

-- Deferred FK constraints for the tables created BEFORE the methodologies block
-- (fresh-bootstrap order, fixplan C1/W1): their methodology_id columns are plain
-- uuid in the CREATE TABLE and get their FK here. Constraint names match what
-- prod got from 0030/0053's inline REFERENCES (default naming), so prod and a
-- fresh install stay pg_dump-identical.
alter table weekly_reviews add constraint weekly_reviews_methodology_id_fkey
  foreign key (methodology_id) references methodologies(id) on delete set null;
alter table periodic_reviews add constraint periodic_reviews_methodology_id_fkey
  foreign key (methodology_id) references methodologies(id) on delete set null;
alter table prop_accounts add constraint prop_accounts_methodology_id_fkey
  foreign key (methodology_id) references methodologies(id) on delete set null;
alter table trade_contracts add constraint trade_contracts_methodology_id_fkey
  foreign key (methodology_id) references methodologies(id) on delete set null;

-- Journal ownership (0044, audit blocker N1): trades.methodology_id has a plain
-- FK, so nothing else stops a write from pointing a trade at a *system template*
-- or another user's journal (the client can do exactly that when its profile
-- fetch fails and the WPM-template fallback kicks in). Any non-null value must
-- be one of the trade owner's own (non-system) methodologies. Invoker rights:
-- the methodologies RLS lets a user see their own rows, which is all this needs.
create or replace function enforce_trades_journal_ownership() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.methodology_id is not null and not exists (
    select 1 from methodologies m
    where m.id = new.methodology_id
      and m.user_id = new.user_id
      and not m.is_system
  ) then
    raise exception 'trades.methodology_id must reference one of the trade owner''s own journals (not a system template)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_trades_journal_ownership
  before insert or update of methodology_id, user_id on trades
  for each row execute function enforce_trades_journal_ownership();

-- ---------- INDEXES ----------
create index idx_trades_user on trades(user_id);
create index idx_trades_datum_open on trades(datum_open);
create index idx_trades_fase on trades(fase);
create index idx_trades_methodology on trades(methodology_id);
-- Hoofdleespad (0052): elke journal-gescopeerde fetch filtert op
-- (user_id, methodology_id) en sorteert/vergelijkt op datum_open.
create index idx_trades_user_methodology_datum on trades(user_id, methodology_id, datum_open);
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
create trigger trg_habits_updated_at before update on habits
  for each row execute function set_updated_at();
create trigger trg_daily_journal_entries_updated_at before update on daily_journal_entries
  for each row execute function set_updated_at();
-- 0057: review_sections had an updated_at column but never a trigger — every
-- edit left it at its created_at value (meta-audit §4.2).
create trigger trg_review_sections_updated_at before update on review_sections
  for each row execute function set_updated_at();

-- ---------- render-time label translation: renaming un-freezes (see 0047) ----------
-- Rewriting the free text without explicitly supplying a new key clears the key,
-- so the user's own wording wins over the catalogue translation from then on.
create or replace function methodology_fields_clear_stale_keys()
returns trigger
language plpgsql
as $$
begin
  if new.label is distinct from old.label
     and new.label_key is not distinct from old.label_key then
    new.label_key := null;
  end if;
  if new.group_label is distinct from old.group_label
     and new.group_key is not distinct from old.group_key then
    new.group_key := null;
  end if;
  return new;
end;
$$;

create trigger trg_methodology_fields_clear_stale_keys
  before update on methodology_fields
  for each row execute function methodology_fields_clear_stale_keys();

-- ---------- timezone-aware trading session mapping (see 0019 + 0051) ----------
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

-- 0036-conventie (zie delete_own_account): anon by name revoken.
revoke execute on function compute_sessie(cc_enum, date, text) from public, anon;
grant execute on function compute_sessie(cc_enum, date, text) to authenticated;

-- Time-based sibling (0051): (date, real open time, tz) -> session, same
-- Brussels-anchored buckets. Used when trades.tijd_open is filled in.
create or replace function compute_sessie_at(p_datum date, p_tijd time, p_tz text)
returns sessie_enum
language plpgsql
stable
as $$
declare
  brussels_hour int;
begin
  if p_datum is null or p_tijd is null then
    return null;
  end if;

  brussels_hour := extract(
    hour from
      ((p_datum + p_tijd)
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

revoke execute on function compute_sessie_at(date, time, text) from public, anon;
grant execute on function compute_sessie_at(date, time, text) to authenticated;

create or replace function trades_set_sessie() returns trigger
language plpgsql as $$
declare
  v_tz text;
begin
  select timezone into v_tz from profiles where id = new.user_id;
  if new.tijd_open is not null then
    new.sessie := compute_sessie_at(new.datum_open, new.tijd_open, coalesce(v_tz, 'Europe/Brussels'));
  else
    new.sessie := compute_sessie(new.cc, new.datum_open, coalesce(v_tz, 'Europe/Brussels'));
  end if;
  return new;
end;
$$;

create trigger trg_trades_set_sessie
  before insert or update of cc, datum_open, tijd_open on trades
  for each row execute function trades_set_sessie();

-- Re-bucket a user's trades when they change their timezone (time-aware, 0051).
create or replace function profiles_recompute_sessie() returns trigger
language plpgsql as $$
begin
  if new.timezone is distinct from old.timezone then
    update trades set sessie = case
      when tijd_open is not null then compute_sessie_at(datum_open, tijd_open, new.timezone)
      else compute_sessie(cc, datum_open, new.timezone)
    end
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
-- The default name is the language-neutral 'Journal' (0035) — the trigger runs in the DB
-- and can't know the UI language, so a Dutch 'Mijn journal' would leak into the EN UI;
-- onboarding (fase C) may rename it client-side later.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_meth uuid;
begin
  insert into public.methodologies (user_id, naam, is_system, asset_class)
  values (new.id, 'Journal', false, null)
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
  -- GDPR right to erasure covers the uploaded chart screenshots too (0044,
  -- audit blocker N2). Files live under a per-user `{uid}/...` prefix in the
  -- private `screenshots` bucket (0039); this must run BEFORE the user row is
  -- gone, while auth.uid() still resolves.
  delete from storage.objects
  where bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text;

  delete from auth.users where id = auth.uid();
end;
$$;

-- 0036-conventie: Supabase default privileges granten anon EXECUTE op elke
-- nieuwe functie — anon moet bij naam gerevoked worden, `from public` alleen
-- laat die grant staan.
revoke all on function delete_own_account() from public, anon;
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

revoke all on function is_admin() from public, anon;
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
    and not t.is_open
  group by t.backtest_project_id;
$$;

-- Supabase default privileges grant anon EXECUTE directly, so revoke it by name
-- — "from public" alone leaves the anon grant in place.
revoke execute on function get_project_trade_summaries() from public, anon;
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

  -- track_exit reist mee de fork in (0057) — 0048 hercreëerde deze insert
  -- zonder de 0050-kolom, waardoor een fork de opt-in stil verloor.
  insert into methodologies (user_id, naam, is_system, asset_class, instrument_config, track_exit)
  select auth.uid(), naam, false, asset_class, instrument_config, track_exit
  from methodologies where id = source_id
  returning id into new_id;

  if new_id is null then
    raise exception 'source methodology % not found or not visible', source_id;
  end if;

  insert into methodology_fields
    (methodology_id, fase_id, field_key, label, label_key, field_type, options, is_computed,
     group_label, group_key, required, show_when_values, sort_order)
  select new_id, null, field_key, label, label_key, field_type, options, is_computed,
         group_label, group_key, required, show_when_values, sort_order
  from methodology_fields where methodology_id = source_id;

  update methodology_fields nf
  set show_when_field_id = np.id
  from methodology_fields sf
  join methodology_fields sp on sp.id = sf.show_when_field_id
  join methodology_fields np on np.methodology_id = new_id and np.field_key = sp.field_key
  where sf.methodology_id = source_id
    and nf.methodology_id = new_id
    and nf.field_key = sf.field_key;

  -- N5 (0048): take the configurable review sections along into the fork.
  insert into review_sections
    (methodology_id, review_kind, section_key, label, label_key, input_type, sort_order)
  select new_id, review_kind, section_key, label, label_key, input_type, sort_order
  from review_sections where methodology_id = source_id;

  return new_id;
end;
$$;

revoke all on function fork_methodology(uuid) from public, anon;
grant execute on function fork_methodology(uuid) to authenticated;

-- ---------- auto-link trade <-> weekly_review ----------
-- Two triggers keep the link in sync in both directions:
--   * new/edited trade -> find existing review for its ISO week (below; since
--     0052 an UPDATE that really changes datum_open/methodology_id re-resolves
--     the link — M1-a: a trade edited into another week no longer sticks to the
--     old review)
--   * new review -> backfill existing live trades of that week (further down)
create or replace function link_trade_to_weekly_review() returns trigger as $$
declare
  iso_year int;
  iso_week int;
  found_id uuid;
begin
  -- backtest_project_id is not null => project trade, never belongs to a weekly review
  if new.backtest_project_id is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Ongewijzigd 0030-gedrag: een expliciet meegegeven koppeling respecteren.
    if new.weekly_review_id is not null then
      return new;
    end if;
  else
    -- UPDATE: alleen her-resolven als de week-bepalende velden écht wijzigen —
    -- de kolomlijst van de trigger vuurt al bij het NOEMEN van de kolom in SET
    -- (het volle trade-formulier stuurt altijd alles mee), dus vergelijk zelf.
    if new.datum_open is not distinct from old.datum_open
       and new.methodology_id is not distinct from old.methodology_id then
      return new;
    end if;
  end if;
  iso_year := extract(isoyear from new.datum_open);
  iso_week := extract(week from new.datum_open);
  select id into found_id from weekly_reviews
    where user_id = new.user_id
      and methodology_id is not distinct from new.methodology_id
      and jaar = iso_year and week_nummer = iso_week
    limit 1;
  new.weekly_review_id := found_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_link_trade_weekly_review
  before insert or update of datum_open, methodology_id on trades
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

-- ---------- rename_field_option (Fase R — M5, see 0045) ----------
-- Transactional option rename: option list + sibling show_when conditions +
-- every stored answer in trades.custom, in ONE call. SECURITY INVOKER: every
-- UPDATE re-checks the caller's RLS. Mirrors the client-side guards it
-- replaced: own non-system methodology only, `fase` locked (legacy enum),
-- enum field, old value must exist, case-insensitive collision refuses.
create or replace function rename_field_option(p_field_id uuid, p_old_value text, p_new_value text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_field methodology_fields%rowtype;
  v_new text := btrim(p_new_value);
  v_migrated integer := 0;
begin
  -- Lock the field row for the duration so two concurrent renames of the same
  -- field serialize instead of interleaving their option-list rewrites.
  select f.* into v_field
  from methodology_fields f
  join methodologies m on m.id = f.methodology_id
  where f.id = p_field_id
    and m.user_id = auth.uid()
    and not m.is_system
  for update of f;

  if not found then
    raise exception 'field not found or not editable' using errcode = 'P0002';
  end if;
  if v_field.field_key = 'fase' then
    raise exception 'legacy field is locked' using errcode = '23514';
  end if;
  if v_field.field_type <> 'enum' or v_field.options is null or not (v_field.options ? p_old_value) then
    raise exception 'option not found' using errcode = 'P0002';
  end if;
  if v_new = '' or v_new = p_old_value then
    return 0;
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_field.options) as o(val)
    where o.val <> p_old_value and lower(o.val) = lower(v_new)
  ) then
    raise exception 'option already exists' using errcode = '23505';
  end if;

  -- 1. The option list itself, position preserved.
  update methodology_fields
  set options = (
    select jsonb_agg(case when o.val = p_old_value then to_jsonb(v_new) else to_jsonb(o.val) end order by o.ord)
    from jsonb_array_elements_text(v_field.options) with ordinality as o(val, ord)
  )
  where id = p_field_id;

  -- 2. Sibling fields whose show_when condition references the old value —
  -- without this, a rename would silently break conditional visibility.
  update methodology_fields f
  set show_when_values = (
    select jsonb_agg(case when s.val = p_old_value then to_jsonb(v_new) else to_jsonb(s.val) end order by s.ord)
    from jsonb_array_elements_text(f.show_when_values) with ordinality as s(val, ord)
  )
  where f.show_when_field_id = p_field_id
    and f.show_when_values ? p_old_value;

  -- 3. Migrate stored answers: every trade of this journal holding the old
  -- value in its custom bag. One statement — no 1000-row pagination, no chunks.
  update trades t
  set custom = jsonb_set(t.custom, array[v_field.field_key], to_jsonb(v_new))
  where t.user_id = auth.uid()
    and t.methodology_id = v_field.methodology_id
    and t.custom ->> v_field.field_key = p_old_value;
  get diagnostics v_migrated = row_count;

  return v_migrated;
end;
$$;

revoke all on function rename_field_option(uuid, text, text) from public, anon;
grant execute on function rename_field_option(uuid, text, text) to authenticated;

-- ---------- create_journal (M4-a, see 0052) ----------
-- Journal-aanmaak (methodology + velden + activatie) als één transactie i.p.v.
-- 3 losse client-writes — een netwerkfout halverwege laat geen orphan-journal
-- of duplicaat meer achter. SECURITY INVOKER zodat alle RLS gewoon geldt.
-- p_fields: jsonb-array van veld-objecten in palet-volgorde (FieldInput-shape,
-- useMethodologyEditor.ts); sort_order = arraypositie (1-based).
create or replace function create_journal(
  p_name text,
  p_fields jsonb,
  p_asset_class text,
  p_instrument_config jsonb,
  p_track_exit boolean,
  p_reuse_active_if_empty boolean
) returns uuid
language plpgsql
security invoker
as $$
declare
  uid uuid := auth.uid();
  target_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Onboarding/empty-state: hergebruik het actieve journal als dat je eigen,
  -- nog lege journal is (zelfde reuseActiveIfEmpty-regel die de client had) —
  -- zo blijft er geen leeg trigger-journal als wees achter.
  if p_reuse_active_if_empty then
    select m.id into target_id
    from profiles p
    join methodologies m on m.id = p.methodology_id
    where p.id = uid
      and m.user_id = uid
      and not m.is_system
      and not exists (select 1 from methodology_fields f where f.methodology_id = m.id);
  end if;

  if target_id is not null then
    update methodologies
       set naam = p_name,
           asset_class = p_asset_class,
           instrument_config = p_instrument_config,
           track_exit = p_track_exit
     where id = target_id;
  else
    insert into methodologies (user_id, naam, is_system, asset_class, instrument_config, track_exit)
    values (uid, p_name, false, p_asset_class, p_instrument_config, p_track_exit)
    returning id into target_id;
  end if;

  insert into methodology_fields
    (methodology_id, field_key, label, label_key, field_type, options,
     required, group_label, group_key, show_when_field_id, show_when_values, sort_order)
  select target_id,
         ord.f->>'field_key',
         ord.f->>'label',
         ord.f->>'label_key',
         ord.f->>'field_type',
         nullif(ord.f->'options', 'null'::jsonb),
         coalesce((ord.f->>'required')::boolean, false),
         ord.f->>'group_label',
         ord.f->>'group_key',
         (ord.f->>'show_when_field_id')::uuid,
         nullif(ord.f->'show_when_values', 'null'::jsonb),
         ord.n::int
  from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) with ordinality as ord(f, n);

  update profiles set methodology_id = target_id where id = uid;

  return target_id;
end;
$$;

revoke execute on function create_journal(text, jsonb, text, jsonb, boolean, boolean) from public, anon;
grant execute on function create_journal(text, jsonb, text, jsonb, boolean, boolean) to authenticated;

-- ---------- SHARE-LAAG (Fase M — 0040/0042/0043/0047/0048/0052-eindstand) ----------
-- ⚠️ BINDENDE CONVENTIE (0052, tweede regressie in deze familie): een
-- `create or replace` op een share-RPC vertrekt ALTIJD van de body uit de
-- LAATSTE migratie die de functie definieerde — nooit van een oudere versie.
-- 0048 hercreëerde get_shared_review vanaf de 0042-body en liet daarmee het
-- `and not t.is_open`-filter uit 0043 vallen, waardoor een anonieme
-- link-houder de lopende posities van de owner zag.
--
-- token = capability: wie de link heeft, ziet het journal/de review. Owner
-- beheert eigen rijen via RLS; anon leest uitsluitend via de SECURITY DEFINER
-- RPC's — bewust géén RLS-policy op trades voor anon (kleinste oppervlak).
create table share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Welk journal gedeeld wordt. null = het legacy/ongescopete journal
  -- (trades.methodology_id is null), zelfde semantiek als useTrades.
  methodology_id uuid references methodologies(id) on delete cascade,
  scope text not null default 'journal' check (scope in ('journal', 'review')),
  -- 2× gen_random_uuid() zonder streepjes = 64 hex-tekens (~244 bits entropie).
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  -- null = verloopt nooit; de app zet standaard een vervaldatum (30 dagen).
  expires_at timestamptz,
  revoked boolean not null default false,
  -- Review-share (0042): precies één van beide gezet bij scope 'review'. Twee
  -- aparte FK-kolommen i.p.v. één polymorf id — echte referentiële integriteit,
  -- en een verwijderde review trekt zijn links automatisch in.
  weekly_review_id uuid references weekly_reviews(id) on delete cascade,
  periodic_review_id uuid references periodic_reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint share_links_scope_refs_check check (
    (scope = 'journal' and weekly_review_id is null and periodic_review_id is null)
    or (scope = 'review'
        and ((weekly_review_id is not null)::int + (periodic_review_id is not null)::int = 1))
  )
);

create index idx_share_links_user_methodology on share_links(user_id, methodology_id);
create index idx_share_links_weekly_review
  on share_links(weekly_review_id) where weekly_review_id is not null;
create index idx_share_links_periodic_review
  on share_links(periodic_review_id) where periodic_review_id is not null;

alter table share_links enable row level security;

-- Owner beheert eigen links. De with-check eist óók dat het gedeelde
-- journal/de review van de inserter zelf is — de kale FK wordt als table-owner
-- gecheckt (bypasst RLS), dus zonder deze subqueries zou een geldige vreemde
-- uuid geaccepteerd worden en via de RPC andermans data prijsgeven.
-- NB: share_links heeft BEWUST géén admin_select-carve-out — tokens zijn
-- capabilities; een admin die andermans tokens ziet, zou andermans shares
-- kunnen openen. Niet "fixen".
create policy "share_links_owner_all" on share_links
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      methodology_id is null
      or exists (
        select 1 from methodologies m
        where m.id = methodology_id and m.user_id = auth.uid()
      )
    )
    and (
      weekly_review_id is null
      or exists (
        select 1 from weekly_reviews r
        where r.id = weekly_review_id and r.user_id = auth.uid()
      )
    )
    and (
      periodic_review_id is null
      or exists (
        select 1 from periodic_reviews r
        where r.id = periodic_review_id and r.user_id = auth.uid()
      )
    )
  );

revoke all on table share_links from anon;

-- De ENE trade-allow-list voor alle share-RPC's (0042, eindstand 0052 incl.
-- is_open + tijd_open). Geen user_id/import_ref; screenshot-kolommen alleen
-- als externe URL (bucket-paden bevatten de owner-uuid en zijn voor anon toch
-- niet te signen). Een nieuwe trades-kolom delen = een bewuste wijziging hier.
-- Niet voor anon aanroepbaar — alleen de definer-RPC's gebruiken hem.
create or replace function shared_trade_json(t trades)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', t.id,
    'fase', t.fase,
    'datum_open', t.datum_open,
    'tijd_open', t.tijd_open,
    'datum_sluiting', t.datum_sluiting,
    'duur_dagen', t.duur_dagen,
    'is_open', t.is_open,
    'pair', t.pair,
    'instrument', t.instrument,
    'direction', t.direction,
    'outcome', t.outcome,
    'resultaat_pct', t.resultaat_pct,
    'risk_pct', t.risk_pct,
    'trade_evaluation', t.trade_evaluation,
    'weekly_criteria', t.weekly_criteria,
    'weekly_kenmerk', t.weekly_kenmerk,
    'trade_concept', t.trade_concept,
    'entry', t.entry,
    'cc', t.cc,
    'sessie', t.sessie,
    'nieuws', t.nieuws,
    'w_confirm', t.w_confirm,
    'd_confirm', t.d_confirm,
    'h4_confirm', t.h4_confirm,
    'w_screenshot', case when t.w_screenshot ~* '^https?://' then t.w_screenshot end,
    'd_screenshot', case when t.d_screenshot ~* '^https?://' then t.d_screenshot end,
    'h4_screenshot', case when t.h4_screenshot ~* '^https?://' then t.h4_screenshot end,
    'h2_screenshot', case when t.h2_screenshot ~* '^https?://' then t.h2_screenshot end,
    'extra_d_conf', t.extra_d_conf,
    'notes', t.notes,
    'fase1_daily_respecteert_zone', t.fase1_daily_respecteert_zone,
    'fase1_spelers_verleden', t.fase1_spelers_verleden,
    'fase2_daily_respecteert_zone', t.fase2_daily_respecteert_zone,
    'fase2_structuur', t.fase2_structuur,
    'fase3_zone_min_2_touches', t.fase3_zone_min_2_touches,
    'fase3_engulfing_candle', t.fase3_engulfing_candle,
    'fase3_beide', t.fase3_beide,
    'fase3_structuur', t.fase3_structuur,
    'fase4_weekly_bevestigingscandle', t.fase4_weekly_bevestigingscandle,
    'weekly_review_id', t.weekly_review_id,
    'backtest_project_id', t.backtest_project_id,
    'methodology_id', t.methodology_id,
    'custom', t.custom,
    'created_at', t.created_at,
    'updated_at', t.updated_at
  );
$$;

revoke all on function shared_trade_json(trades) from public, anon, authenticated;

-- Veld-definities van het gedeelde journal (0042, eindstand 0047 incl.
-- label_key/group_key), voor de custom-veld-rijen in de trade-detail-modal.
create or replace function shared_methodology_fields(mid uuid, owner_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'field_key', f.field_key,
        'label', f.label,
        'label_key', f.label_key,
        'field_type', f.field_type,
        'options', to_jsonb(f.options),
        'group_label', f.group_label,
        'group_key', f.group_key,
        'is_computed', f.is_computed,
        'sort_order', f.sort_order
      ) order by f.sort_order, f.field_key)
      from methodology_fields f
      join methodologies m on m.id = f.methodology_id
      where f.methodology_id = mid and m.user_id = owner_id
    ),
    '[]'::jsonb
  );
$$;

revoke all on function shared_methodology_fields(uuid, uuid) from public, anon, authenticated;

-- Sectie-definities van het gedeelde journal (0048), voor de custom-secties in
-- de gedeelde review. null journal → []; leeg = client resolvet de defaults.
create or replace function shared_review_sections(mid uuid, owner_id uuid, kind text)
returns jsonb
language sql
stable
as $$
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'section_key', s.section_key,
        'label', s.label,
        'label_key', s.label_key,
        'input_type', s.input_type,
        'sort_order', s.sort_order
      ) order by s.sort_order, s.section_key)
      from review_sections s
      join methodologies m on m.id = s.methodology_id
      where s.methodology_id = mid and m.user_id = owner_id and s.review_kind = kind
    ),
    '[]'::jsonb
  );
$$;

revoke all on function shared_review_sections(uuid, uuid, text) from public, anon, authenticated;

-- get_shared_journal (eindstand 0043: 0042-shape + `and not t.is_open`): het
-- enige leespad voor een anonieme coach. SECURITY DEFINER → de body filtert
-- strak; missed trades blijven server-side achter (domeinregel), open trades
-- ook. Geen rij (ongeldig/ingetrokken/verlopen token) → null, geen error.
create or replace function get_shared_journal(share_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'journal_name', m.naam,
    'display_name', p.display_name,
    'result_unit', p.result_unit,
    'hide_fase', p.hide_fase,
    'fields', shared_methodology_fields(l.methodology_id, l.user_id),
    'trades', coalesce(
      (
        select jsonb_agg(shared_trade_json(t) order by t.datum_open, t.id)
        from trades t
        where t.user_id = l.user_id
          and t.backtest_project_id is null
          and t.methodology_id is not distinct from l.methodology_id
          and t.trade_evaluation is distinct from 'Missed trade'
          and not t.is_open
      ),
      '[]'::jsonb
    )
  )
  from share_links l
  join profiles p on p.id = l.user_id
  left join methodologies m on m.id = l.methodology_id and m.user_id = l.user_id
  where l.token = share_token
    and l.scope = 'journal'
    and not l.revoked
    and (l.expires_at is null or l.expires_at > now());
$$;

revoke execute on function get_shared_journal(text) from public;
grant execute on function get_shared_journal(text) to anon, authenticated;

-- get_shared_review (eindstand 0052: 0048-body + `and not t.is_open` in BEIDE
-- trades-subqueries). Missed trades gaan hier WEL mee — de client toont ze
-- gebadged en houdt ze uit de stats, identiek aan de eigen review-weergave.
create or replace function get_shared_review(share_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when l.weekly_review_id is not null then
      (
        select jsonb_build_object(
          'kind', 'weekly',
          'journal_name', (select m.naam from methodologies m where m.id = r.methodology_id and m.user_id = l.user_id),
          'display_name', p.display_name,
          'result_unit', p.result_unit,
          'hide_fase', p.hide_fase,
          'sections', shared_review_sections(r.methodology_id, l.user_id, 'weekly'),
          'review', jsonb_build_object(
            'id', r.id,
            'week_nummer', r.week_nummer,
            'jaar', r.jaar,
            'titel', r.titel,
            'verhalen', r.verhalen,
            'technisch', r.technisch,
            'mentaal_owner', r.mentaal_owner,
            'mentaal_trader', r.mentaal_trader,
            'acties', to_jsonb(r.acties),
            'takeaway', r.takeaway,
            'overall_comment', r.overall_comment,
            'content', r.content
          ),
          'trades', coalesce(
            (
              select jsonb_agg(shared_trade_json(t) order by t.datum_open, t.id)
              from trades t
              where t.user_id = l.user_id
                and t.weekly_review_id = r.id
                and t.backtest_project_id is null
                and not t.is_open
                and t.methodology_id is not distinct from r.methodology_id
            ),
            '[]'::jsonb
          )
        )
        from weekly_reviews r
        where r.id = l.weekly_review_id and r.user_id = l.user_id
      )
    else
      (
        select jsonb_build_object(
          'kind', 'periodic',
          'journal_name', (select m.naam from methodologies m where m.id = r.methodology_id and m.user_id = l.user_id),
          'display_name', p.display_name,
          'result_unit', p.result_unit,
          'hide_fase', p.hide_fase,
          'sections', shared_review_sections(r.methodology_id, l.user_id, 'periodic'),
          'review', jsonb_build_object(
            'id', r.id,
            'period_type', r.period_type,
            'jaar', r.jaar,
            'periode_nummer', r.periode_nummer,
            'titel', r.titel,
            'technisch', r.technisch,
            'mentaal_owner', r.mentaal_owner,
            'mentaal_trader', r.mentaal_trader,
            'acties', to_jsonb(r.acties),
            'takeaway', r.takeaway,
            'overall_comment', r.overall_comment,
            'periode_overzicht', r.periode_overzicht,
            'content', r.content
          ),
          -- Kalenderperiode identiek aan rangeOfPeriod() client-side
          -- (src/lib/periodRanges.ts): maand / kwartaal / jaar, inclusieve grenzen.
          'trades', coalesce(
            (
              select jsonb_agg(shared_trade_json(t) order by t.datum_open, t.id)
              from trades t
              where t.user_id = l.user_id
                and t.backtest_project_id is null
                and not t.is_open
                and t.methodology_id is not distinct from r.methodology_id
                and t.datum_open >= case r.period_type
                    when 'month' then make_date(r.jaar, r.periode_nummer, 1)
                    when 'quarter' then make_date(r.jaar, (r.periode_nummer - 1) * 3 + 1, 1)
                    else make_date(r.jaar, 1, 1)
                  end
                and t.datum_open <= case r.period_type
                    when 'month' then (make_date(r.jaar, r.periode_nummer, 1) + interval '1 month - 1 day')::date
                    when 'quarter' then (make_date(r.jaar, (r.periode_nummer - 1) * 3 + 1, 1) + interval '3 months - 1 day')::date
                    else make_date(r.jaar, 12, 31)
                  end
            ),
            '[]'::jsonb
          )
        )
        from periodic_reviews r
        where r.id = l.periodic_review_id and r.user_id = l.user_id
      )
  end
  from share_links l
  join profiles p on p.id = l.user_id
  where l.token = share_token
    and l.scope = 'review'
    and not l.revoked
    and (l.expires_at is null or l.expires_at > now());
$$;

revoke execute on function get_shared_review(text) from public;
grant execute on function get_shared_review(text) to anon, authenticated;

-- ---------- STORAGE: private `screenshots`-bucket (Fase K, see 0039) ----------
-- Vereist een Supabase-omgeving (storage-schema); op een kale Postgres zonder
-- Supabase faalt dit blok — dan weglaten. Private bucket: de app mint signed
-- URLs on demand; delete_own_account() verwijdert de per-user prefix.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screenshots',
  'screenshots',
  false,
  5242880, -- 5 * 1024 * 1024
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Per-user RLS op de objects: eerste pad-segment == auth.uid(). anon krijgt
-- geen enkele policy ("anon niets"-hygiëne).
create policy "screenshots_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "screenshots_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "screenshots_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "screenshots_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- RLS ----------
alter table trades enable row level security;
alter table weekly_reviews enable row level security;
alter table prop_accounts enable row level security;
alter table payouts enable row level security;
alter table backtest_projects enable row level security;
alter table periodic_reviews enable row level security;
alter table trade_contracts enable row level security;
alter table habits enable row level security;
alter table habit_days enable row level security;
alter table daily_journal_entries enable row level security;
alter table profiles enable row level security;
alter table custom_options enable row level security;
alter table methodologies enable row level security;
alter table methodology_fases enable row level security;
alter table methodology_fields enable row level security;
alter table review_sections enable row level security;

-- No insert/delete policy for profiles: rows are created only by the
-- handle_new_user() trigger above and removed via the auth.users FK cascade.
create policy "profiles_owner_select" on profiles
  for select using (id = auth.uid());
create policy "profiles_owner_update" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Column-level UPDATE grant (0044, audit blocker K1): the row policy above
-- can't limit *which columns* an update touches — with the blanket table grant
-- a user could PATCH their own role='admin' (→ the admin read-all policies
-- expose every user's data), beta_features or plan. Only the six self-service
-- columns updateProfile() (useAuth.tsx) writes stay writable; updated_at is
-- stamped by trg_profiles_updated_at, which is exempt from column grants.
revoke update on table profiles from authenticated;
grant update (display_name, hide_fase, timezone, methodology_id, result_unit, onboarded_at)
  on table profiles to authenticated;
-- anon has no profiles policy at all (0 rows) — drop its default grants too
-- ("anon niets" hygiene, see 0038/0040; the share RPCs are SECURITY DEFINER).
revoke all on table profiles from anon;

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

-- Review sections follow their methodology's visibility, exactly like methodology_fields (Fase N5, 0048).
create policy "review_sections_select" on review_sections
  for select using (exists (
    select 1 from methodologies m where m.id = review_sections.methodology_id
      and (m.user_id = auth.uid() or (m.is_system and m.user_id is null))));
create policy "review_sections_write" on review_sections
  for all using (exists (
    select 1 from methodologies m where m.id = review_sections.methodology_id and m.user_id = auth.uid()))
  with check (exists (
    select 1 from methodologies m where m.id = review_sections.methodology_id and m.user_id = auth.uid()));

-- Read-only admin carve-out (0046, mirrors 0008) — the admin debug view needs the
-- viewed user's own methodology + fields to render their journal-type breakdowns.
-- `to authenticated` is required so anon never evaluates is_admin() (see 0036).
create policy "methodologies_admin_select" on methodologies
  for select to authenticated using (is_admin());
create policy "methodology_fields_admin_select" on methodology_fields
  for select to authenticated using (is_admin());
create policy "review_sections_admin_select" on review_sections
  for select to authenticated using (is_admin());

create policy "trades_owner_all" on trades
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weekly_reviews_owner_all" on weekly_reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "periodic_reviews_owner_all" on periodic_reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "trade_contracts_owner_all" on trade_contracts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habits_owner_all" on habits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habit_days_owner_all" on habit_days
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "daily_journal_entries_owner_all" on daily_journal_entries
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
-- All scoped `to authenticated` (0036): a policy with no TO clause also applies to
-- anon, which — after 0036 revoked anon's EXECUTE on is_admin() — would make every
-- anon SELECT on these tables fail with 42501. anon reads go through the owner
-- policies (auth.uid() = null → zero rows), never through is_admin().
create policy "profiles_admin_select" on profiles
  for select to authenticated using (is_admin());
create policy "trades_admin_select" on trades
  for select to authenticated using (is_admin());
create policy "weekly_reviews_admin_select" on weekly_reviews
  for select to authenticated using (is_admin());
create policy "periodic_reviews_admin_select" on periodic_reviews
  for select to authenticated using (is_admin());
create policy "trade_contracts_admin_select" on trade_contracts
  for select to authenticated using (is_admin());
create policy "habits_admin_select" on habits
  for select to authenticated using (is_admin());
create policy "habit_days_admin_select" on habit_days
  for select to authenticated using (is_admin());
create policy "daily_journal_entries_admin_select" on daily_journal_entries
  for select to authenticated using (is_admin());
create policy "backtest_projects_admin_select" on backtest_projects
  for select to authenticated using (is_admin());
create policy "prop_accounts_admin_select" on prop_accounts
  for select to authenticated using (is_admin());
create policy "payouts_admin_select" on payouts
  for select to authenticated using (is_admin());

-- ---------- MIGRATIE-REGISTRY (0057, fixplan C3) ----------
-- scripts/run-migration.mjs registreert elke gedraaide migratie hier en weigert
-- een tweede run van hetzelfde bestand. Geen RLS/grants voor app-rollen: dit is
-- puur operationele metadata, alleen benaderd via de directe DB-verbinding.
create table schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
revoke all on table schema_migrations from anon, authenticated;

-- Een verse bootstrap IS de eindstand t/m 0057 — vul de registry meteen, zodat
-- de runner een oude migratie tegen dit project weigert i.p.v. dubbel draait.
insert into schema_migrations (filename) values
  ('0001_backtest_projects.sql'),
  ('0002_trade_evaluation.sql'),
  ('0003_missed_trade_and_periodic_reviews.sql'),
  ('0004_weekly_review_live_trades_only.sql'),
  ('0005_profiles.sql'),
  ('0006_delete_own_account.sql'),
  ('0007_periodic_review_extra_fields.sql'),
  ('0008_admin_role.sql'),
  ('0009_hide_fase.sql'),
  ('0010_custom_entries.sql'),
  ('0011_prop_account_pnl_pct.sql'),
  ('0012_risk_pct.sql'),
  ('0013_prop_firm_rules.sql'),
  ('0014_drop_tpfs.sql'),
  ('0015_prop_account_private_type.sql'),
  ('0016_project_trade_summaries.sql'),
  ('0017_trade_import_ref.sql'),
  ('0018_custom_trade_concepts.sql'),
  ('0019_timezone_sessions.sql'),
  ('0020_backfill_trades_on_review_insert.sql'),
  ('0020_configurable_methodology.sql'),
  ('0021_weekly_review_verhalen.sql'),
  ('0022_journal_foundation.sql'),
  ('0023_fase_as_field.sql'),
  ('0024_fork_methodology.sql'),
  ('0025_empty_journal_for_new_users.sql'),
  ('0026_rename_methodology.sql'),
  ('0027_journal_presets.sql'),
  ('0028_scalper_presets.sql'),
  ('0029_trade_direction.sql'),
  ('0030_journal_scoping.sql'),
  ('0031_fork_users_off_shared_template.sql'),
  ('0032_trade_instrument.sql'),
  ('0033_beta_features.sql'),
  ('0035_neutral_journal_name.sql'),
  ('0036_revoke_anon_execute.sql'),
  ('0037_result_unit.sql'),
  ('0038_revoke_anon_project_summaries.sql'),
  ('0039_screenshots_bucket.sql'),
  ('0040_share_links.sql'),
  ('0041_onboarded_at.sql'),
  ('0042_review_share_links.sql'),
  ('0043_open_trades.sql'),
  ('0044_audit_hardening.sql'),
  ('0045_rename_field_option.sql'),
  ('0046_admin_methodology_select.sql'),
  ('0047_field_label_keys.sql'),
  ('0048_review_sections.sql'),
  ('0049_mae_mfe.sql'),
  ('0050_methodology_track_exit.sql'),
  ('0051_tijd_open.sql'),
  ('0052_fix_review_share_open_trades.sql'),
  ('0053_trade_contracts.sql'),
  ('0054_habits.sql'),
  ('0055_daily_journal.sql'),
  ('0056_configurable_habits.sql'),
  ('0057_registry_fork_track_exit.sql');
