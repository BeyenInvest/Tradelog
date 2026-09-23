-- =========================================================
-- Beyen Invest — migration 0061: per-journal instelbare timeframes voor de vier
-- snapshot-slots van de TradingView-extensie (plan-tv-extensie-engines.md §8).
--
-- Waarom: de extensie schiet de slots hardcoded op W/D/4H/2H (WPM-erfgoed).
-- Het journal is er voor alle strategieën — een scalper wil 15m/5m/1m. De
-- trader kiest de TF's nu per journal; de vier trades-kolommen (w/d/h4/h2_
-- screenshot) veranderen niet van naam of betekenis-per-slot.
--
-- Ontwerp (exact de 0060-conventies):
--   * jsonb, nullable, GEEN default: null = de standaard-TF's (W/D/240/120).
--   * Waarde = JSON-array van exact 4 strings; index 0..3 = slot w / d / h4 / h2.
--     Elke string is een TV-resolution ("W","D","240","15", ...); een lege
--     string op een positie = "gebruik de standaard-TF" voor dát slot.
--   * Geen backfill — bestaande journals blijven op de defaults.
--   * Vorm- én waarde-validatie in de app-laag (whitelist in
--     src/lib/screenshotSlots.ts, óók de trust boundary in de extensie-SW);
--     geen CHECK, zodat een later vijfde slot geen migratie vraagt.
--
-- Bijvangst-fix: fork_methodology kopieerde screenshot_labels (0060) niet mee —
-- zelfde stille-verlies-klasse als de 0048/track_exit-les (0057). De functie
-- wordt hier hercreëerd met screenshot_labels ÉN screenshot_timeframes in de
-- kopie.
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0061_methodology_screenshot_timeframes.sql
-- =========================================================

alter table methodologies add column if not exists screenshot_timeframes jsonb;

comment on column methodologies.screenshot_timeframes is
  'Per-journal TV-timeframes voor de 4 snapshot-slots van de extensie: JSON-array van 4 TV-resolution-strings ("W","D","240","15",...), index 0..3 = w/d/h4/h2. null = standaard (W/D/240/120); lege string per positie = standaard voor dat slot.';

-- ---------- fork_methodology: 0060/0061-kolommen reizen mee de fork in ----------
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

  -- (fase_id viel weg in 0059 — body verder = 0057-eindstand.)
  insert into methodology_fields
    (methodology_id, field_key, label, label_key, field_type, options, is_computed,
     group_label, group_key, required, show_when_values, sort_order)
  select new_id, field_key, label, label_key, field_type, options, is_computed,
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

-- Registratie (runner doet dit ook; on conflict dekt de SQL-editor-route, 0057-conventie).
insert into schema_migrations (filename) values ('0061_methodology_screenshot_timeframes.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- kolom bestaat (verwacht: 1 rij, jsonb, is_nullable = YES):
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--     where table_name = 'methodologies' and column_name = 'screenshot_timeframes';
--   -- fork kopieert de slot-config mee (verwacht: 1 rij met beide kolommen in de body):
--   select prosrc like '%screenshot_timeframes%' and prosrc like '%screenshot_labels%' as fork_ok
--     from pg_proc where proname = 'fork_methodology';
--   -- registry (verwacht: 1 rij):
--   select filename from schema_migrations where filename = '0061_methodology_screenshot_timeframes.sql';
-- =========================================================
