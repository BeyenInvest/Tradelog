-- =========================================================
-- Beyen Invest — migration 0066: ja/nee-velden optioneel als aanvinkvakje.
--
-- Waarom (owner-besluit 2026-10-08, freeze-uitzondering): een veld als
-- "Scale-in" is een vlag — je vinkt 'm aan als het zo is, anders niet. Met de
-- Ja/Nee-knoppen moest je bij élke gewone trade expliciet "Nee" klikken, anders
-- bleef de waarde leeg en viel de trade uit de "Per Scale-in"-analyse (een leeg
-- boolean-veld telt daar niet mee). Per veld kiest de trader nu de weergave.
--
-- Ontwerp:
--   * methodology_fields.checkbox boolean not null default false — false = de
--     bestaande Ja/Nee-knoppen (alle bestaande velden blijven ongewijzigd).
--   * Alleen betekenisvol bij field_type = 'boolean'; de app toont de keuze
--     alleen daar (geen CHECK: een type-wissel hoeft dan niets te resetten).
--   * Semantiek in de app-laag: een vakje kent geen "onbeantwoord" — een leeg
--     vakje (ook een ontbrekende waarde, bv. bij een import) leest als Nee in
--     analyse, filters en weergave. De opgeslagen data verandert niet.
--   * fork_methodology kopieert de kolom mee (0057/0061-les: een nieuwe
--     veld-kolom die de fork niet meeneemt, verdwijnt stil bij het kopiëren).
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0066_field_checkbox.sql
-- =========================================================

alter table methodology_fields add column if not exists checkbox boolean not null default false;

comment on column methodology_fields.checkbox is
  'Alleen voor field_type = boolean: true = toon als aanvinkvakje (leeg = Nee), false = Ja/Nee-knoppen (leeg = onbeantwoord). Zie 0066.';

-- ---------- fork_methodology: checkbox reist mee de fork in ----------
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

  -- track_exit reist mee sinds 0057; screenshot_labels (0060) + screenshot_
  -- timeframes (0061) sinds 0061 — een fork verloor de slot-config anders stil.
  insert into methodologies (user_id, naam, is_system, asset_class, instrument_config, track_exit, screenshot_labels, screenshot_timeframes)
  select auth.uid(), naam, false, asset_class, instrument_config, track_exit, screenshot_labels, screenshot_timeframes
  from methodologies where id = source_id
  returning id into new_id;

  if new_id is null then
    raise exception 'source methodology % not found or not visible', source_id;
  end if;

  -- checkbox (0066) reist mee; verder = 0061-eindstand.
  insert into methodology_fields
    (methodology_id, field_key, label, label_key, field_type, options, is_computed,
     group_label, group_key, required, show_when_values, sort_order, checkbox)
  select new_id, field_key, label, label_key, field_type, options, is_computed,
         group_label, group_key, required, show_when_values, sort_order, checkbox
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

-- Registratie (runner doet dit ook; on conflict dekt de SQL-editor-route, 0057-conventie).
insert into schema_migrations (filename) values ('0066_field_checkbox.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- kolom bestaat (verwacht: 1 rij, boolean, NO, false):
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--     where table_name = 'methodology_fields' and column_name = 'checkbox';
--   -- geen bestaand veld omgezet (verwacht: 0):
--   select count(*) from methodology_fields where checkbox;
--   -- fork kopieert checkbox mee (verwacht: true):
--   select prosrc like '%checkbox%' as fork_ok from pg_proc where proname = 'fork_methodology';
--   -- registry (verwacht: 1 rij):
--   select filename from schema_migrations where filename = '0066_field_checkbox.sql';
-- =========================================================
