-- =========================================================
-- Beyen Invest — migration: configurable methodology (Scope C, cyclus 0)
--
-- Turns the hard-coded "4 fasen" methodology (constants.ts FASES +
-- FASE_KENMERKEN) into per-user data. The fixed Weekly Phase Method system it currently
-- encodes is only meaningful to the owner and a few ex-Weekly Phase Method traders (see
-- CLAUDE.md domain rules / hide_fase) — every other user needs to define their
-- own. This migration ONLY lays down the data model + seeds the Weekly Phase Method template
-- + migrates existing trades. No app code reads any of it yet, and NO existing
-- column is dropped, so behaviour is unchanged for everyone (the whole app keeps
-- reading the old fase_enum + fase*_ columns until a later cyclus flips it over).
--
-- The crux: fase-kenmerken are today fixed columns on `trades`
-- (fase1_daily_respecteert_zone, fase2_structuur, ...). You can't give every
-- user their own columns, so kenmerken move into one flexible `trades.kenmerken`
-- jsonb bag, shaped by that user's methodology config. This migration backfills
-- that bag from the existing columns so the owner's data is preserved exactly.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

-- ---------- CONFIG TABLES ----------
-- A methodology owned by a user (user_id set) or the built-in template
-- (user_id NULL, is_system true — readable by everyone, editable by no one).
create table methodologies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  naam text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The fases of a methodology (replaces the fixed FASES enum). A trade still
-- stores its fase as text in trades.fase for now; wiring trades to fase_id is a
-- later cyclus.
create table methodology_fases (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references methodologies(id) on delete cascade,
  naam text not null,
  sort_order integer not null default 0,
  unique (methodology_id, naam)
);

-- The kenmerk-fields per fase (replaces the hard-coded FASE_KENMERKEN config).
-- field_key is the stable key used inside the trades.kenmerken jsonb bag;
-- field_type is 'boolean' or 'enum' (enum values live in `options`).
-- is_computed mirrors FaseKenmerkConfig.computed (e.g. Fase 3 "Beide?") — stored
-- for config completeness, never written into the jsonb bag (it's derivable).
create table methodology_fields (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references methodologies(id) on delete cascade,
  fase_id uuid not null references methodology_fases(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null check (field_type in ('boolean', 'enum')),
  options jsonb,
  is_computed boolean not null default false,
  sort_order integer not null default 0,
  unique (methodology_id, fase_id, field_key)
);

create index idx_methodology_fases_methodology on methodology_fases(methodology_id);
create index idx_methodology_fields_methodology on methodology_fields(methodology_id);

create trigger trg_methodologies_updated_at before update on methodologies
  for each row execute function set_updated_at();

-- ---------- SEED: the built-in Weekly Phase Method template ----------
-- Seeded BEFORE the profiles alter below, because that alter's column default
-- points at this row (adding the column populates existing rows with it, so the
-- row must already exist or the FK fails). Fixed id keeps every reference
-- deterministic across this migration, schema.sql and later cycli.
insert into methodologies (id, user_id, naam, is_system)
values ('00000000-0000-4000-8000-000000000001', null, 'Weekly Phase Method', true);

insert into methodology_fases (methodology_id, naam, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'Fase 1', 1),
  ('00000000-0000-4000-8000-000000000001', 'Fase 2', 2),
  ('00000000-0000-4000-8000-000000000001', 'Fase 3', 3),
  ('00000000-0000-4000-8000-000000000001', 'Fase 4', 4);

insert into methodology_fields
  (methodology_id, fase_id, field_key, label, field_type, options, is_computed, sort_order)
select
  '00000000-0000-4000-8000-000000000001', f.id,
  v.field_key, v.label, v.field_type, v.options, v.is_computed, v.sort_order
from (values
  ('Fase 1', 'daily_respecteert_zone',    'Daily respecteert zone?',            'boolean', null::jsonb,                false, 1),
  ('Fase 1', 'spelers_verleden',          'Al spelers in verleden (W)?',        'boolean', null::jsonb,                false, 2),
  ('Fase 2', 'daily_respecteert_zone',    'Daily respecteert zone?',            'boolean', null::jsonb,                false, 1),
  ('Fase 2', 'structuur',                 'Structuur',                          'enum',    '["Inner","Outer"]'::jsonb, false, 2),
  ('Fase 3', 'zone_min_2_touches',        'Zone met min. 2 vorige touches?',    'boolean', null::jsonb,                false, 1),
  ('Fase 3', 'engulfing_candle',          'Engulfing candle?',                  'boolean', null::jsonb,                false, 2),
  ('Fase 3', 'beide',                     'Beide?',                             'boolean', null::jsonb,                true,  3),
  ('Fase 3', 'structuur',                 'Structuur',                          'enum',    '["Inner","Outer"]'::jsonb, false, 4),
  ('Fase 4', 'weekly_bevestigingscandle', 'Weekly bevestigingscandle?',         'boolean', null::jsonb,                false, 1)
) as v(fase_naam, field_key, label, field_type, options, is_computed, sort_order)
join methodology_fases f
  on f.methodology_id = '00000000-0000-4000-8000-000000000001' and f.naam = v.fase_naam;

-- ---------- NEW COLUMNS ON EXISTING TABLES ----------
-- trades.methodology_id: which methodology this trade was logged under (nullable
-- for now; the app doesn't set it on insert until a later cyclus).
-- trades.kenmerken: the flexible per-fase kenmerk bag that replaces the fase*_
-- columns. Defaults to '{}' so existing insert paths keep working untouched.
alter table trades add column methodology_id uuid references methodologies(id) on delete set null;
alter table trades add column kenmerken jsonb not null default '{}'::jsonb;
create index idx_trades_methodology on trades(methodology_id);

-- profiles.methodology_id: the user's active methodology. Defaults to the Weekly Phase Method
-- template so free users are on the reference methodology out of the box (adding
-- the column with this default also sets it on every existing profile).
alter table profiles add column methodology_id uuid references methodologies(id) on delete set null
  default '00000000-0000-4000-8000-000000000001';

-- ---------- RLS ----------
alter table methodologies enable row level security;
alter table methodology_fases enable row level security;
alter table methodology_fields enable row level security;

-- Built-in system templates are world-readable; users fully manage their own.
create policy "methodologies_system_select" on methodologies
  for select using (is_system and user_id is null);
create policy "methodologies_owner_all" on methodologies
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Child rows are readable when their parent methodology is visible (own or
-- system), and writable only when the parent is the caller's own.
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

-- ---------- BACKFILL: existing trades onto the Weekly Phase Method template ----------
-- Every trade in the DB today was logged under the Weekly Phase Method system (fase_enum was
-- the only option), so point them all at the template and copy each trade's
-- fase-specific columns into its kenmerken bag. jsonb_strip_nulls drops keys the
-- trader left blank (kenmerken are optional) so an untracked trade gets '{}'.
update trades set
  methodology_id = '00000000-0000-4000-8000-000000000001',
  kenmerken = coalesce(case fase
    when 'Fase 1' then jsonb_strip_nulls(jsonb_build_object(
      'daily_respecteert_zone', fase1_daily_respecteert_zone,
      'spelers_verleden',       fase1_spelers_verleden))
    when 'Fase 2' then jsonb_strip_nulls(jsonb_build_object(
      'daily_respecteert_zone', fase2_daily_respecteert_zone,
      'structuur',              fase2_structuur))
    when 'Fase 3' then jsonb_strip_nulls(jsonb_build_object(
      'zone_min_2_touches',     fase3_zone_min_2_touches,
      'engulfing_candle',       fase3_engulfing_candle,
      'structuur',              fase3_structuur))
    when 'Fase 4' then jsonb_strip_nulls(jsonb_build_object(
      'weekly_bevestigingscandle', fase4_weekly_bevestigingscandle))
  end, '{}'::jsonb);

-- profiles already got the Weekly Phase Method default from the alter above; this is just a
-- belt-and-braces no-op for any row a default somehow missed.
update profiles set methodology_id = '00000000-0000-4000-8000-000000000001'
  where methodology_id is null;
