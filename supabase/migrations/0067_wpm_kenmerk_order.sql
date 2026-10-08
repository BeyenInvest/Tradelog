-- =========================================================
-- Beyen Invest — migration 0067: WPM — "Weekly kenmerk" direct onder "Fase".
--
-- Waarom (owner-besluit 2026-10-08): in de WPM-workflow hoort het weekly
-- kenmerk (trending/corrective/ranging) bij de fase-bepaling, niet verdwaald
-- onderaan na de confirms. De owner had het in z'n eigen journal al zo
-- gesleept; dit trekt het door voor iedereen die WPM gebruikt.
--
-- Wat:
--   * Alleen journals (incl. de systeem-template) die nog EXACT op de
--     standaard-WPM-volgorde van 0059 staan — wie zelf velden verschoof,
--     toevoegde of verwijderde, blijft ongemoeid (de volgorde is van de user).
--   * Daar: nieuwe volgorde fase > weekly_kenmerk > weekly_criteria > ... en
--     weekly_kenmerk verhuist van de groep Markt naar Setup (anders zet het
--     web-formulier 'm onder een eigen "Markt"-kopje i.p.v. onder Fase). Alleen
--     als de groep nog de standaard 'markt' is.
--   * Nieuwe WPM-journals: de `wpm`-startset in src/lib/fieldBlocks.ts volgt
--     dezelfde volgorde (zelfde commit).
--   * Idempotent: na het draaien matcht de oude volgorde nergens meer.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0067_wpm_kenmerk_order.sql
-- =========================================================

with target as (
  select m.id
  from methodologies m
  where (
    select string_agg(f.field_key, ',' order by f.sort_order, f.field_key)
    from methodology_fields f
    where f.methodology_id = m.id
  ) = 'fase,weekly_criteria,trade_concept,entry,w_confirm,d_confirm,h4_confirm,extra_d_conf,weekly_kenmerk,cc,nieuws'
)
update methodology_fields f
set sort_order = array_position(
      array['fase','weekly_kenmerk','weekly_criteria','trade_concept','entry',
            'w_confirm','d_confirm','h4_confirm','extra_d_conf','cc','nieuws'],
      f.field_key),
    group_label = case when f.field_key = 'weekly_kenmerk' and f.group_key = 'markt' then 'Setup' else f.group_label end,
    group_key   = case when f.field_key = 'weekly_kenmerk' and f.group_key = 'markt' then 'setup' else f.group_key end
from target
where f.methodology_id = target.id;

-- Registratie (runner doet dit ook; on conflict dekt de SQL-editor-route, 0057-conventie).
insert into schema_migrations (filename) values ('0067_wpm_kenmerk_order.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- geen journal meer op de oude standaard-volgorde (verwacht: 0):
--   select count(*) from methodologies m
--    where (select string_agg(field_key, ',' order by sort_order, field_key)
--             from methodology_fields where methodology_id = m.id)
--        = 'fase,weekly_criteria,trade_concept,entry,w_confirm,d_confirm,h4_confirm,extra_d_conf,weekly_kenmerk,cc,nieuws';
--   -- kenmerk staat op plek 2 in de systeem-template (verwacht: 2, Setup, setup):
--   select sort_order, group_label, group_key from methodology_fields
--    where methodology_id = '00000000-0000-4000-8000-000000000001' and field_key = 'weekly_kenmerk';
-- =========================================================
