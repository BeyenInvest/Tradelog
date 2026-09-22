-- =========================================================
-- Beyen Invest — migration 0060: per-journal aanpasbare namen voor de vier
-- screenshot-slots (w/d/h4/h2) op methodologies.
--
-- Waarom: de vier vaste screenshot-velden op trades (w_screenshot, d_screenshot,
-- h4_screenshot, h2_screenshot) dragen WPM-erfgoed als naam (Weekly/Daily/4H/
-- Extra). Voor een niet-WPM-journal zegt "Weekly" niets — een scalper wil
-- bijvoorbeeld "1m entry" of "Before/After". De trader kan de slot-namen nu per
-- journal hernoemen zonder dat de trades-kolommen zelf veranderen.
--
-- Ontwerp:
--   * jsonb, nullable, GEEN default: null = de standaardnamen (Weekly/Daily/4H/
--     Extra, resp. Screenshot 1-4 in een journal zonder WPM-startset).
--   * Waarde = JSON-array van exact 4 strings; index 0..3 = w / d / h4 / h2.
--     Een lege string op een positie = "gebruik de standaard" voor dát slot.
--   * Geen backfill — bestaande journals blijven op de defaults.
--   * Validatie van vorm (array van 4 strings) gebeurt in de app-laag; geen CHECK,
--     zodat een later vijfde slot geen migratie vraagt.
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0060_methodology_screenshot_labels.sql
-- =========================================================

alter table methodologies add column if not exists screenshot_labels jsonb;

comment on column methodologies.screenshot_labels is
  'Per-journal namen voor de 4 screenshot-slots: JSON-array van 4 strings, index 0..3 = w/d/h4/h2. null = standaardnamen; lege string per positie = standaard voor dat slot.';

-- Registratie (runner doet dit ook; on conflict dekt de SQL-editor-route, 0057-conventie).
insert into schema_migrations (filename) values ('0060_methodology_screenshot_labels.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- kolom bestaat (verwacht: 1 rij, jsonb, is_nullable = YES):
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--     where table_name = 'methodologies' and column_name = 'screenshot_labels';
--   -- registry (verwacht: 1 rij):
--   select filename from schema_migrations where filename = '0060_methodology_screenshot_labels.sql';
-- =========================================================
