-- =========================================================
-- Beyen Invest — migration 0058: entry-/stop-/target-/exit-prijzen op trades
-- (TV-extensie F2c, docs/plan-tv-extensie-engines.md §2.1).
--
-- Waarom: de extensie leest entry/SL/TP uit TV's position-tool (S0-spike,
-- docs/spike-tv-extensie.md). Alleen planned_rr afleiden en de prijzen
-- weggooien is dataverlies (plan C1) — de latere "gepland vs. gerealiseerd
-- R"-analyse en close-from-chart (F5) hebben de echte prijzen nodig.
--
-- Ontwerp:
--   * numeric(18,8): ruim genoeg voor forex-fracties én crypto; geen float.
--   * Alles nullable — bestaande en handmatige trades hebben geen prijzen.
--   * Set-regel: álles null, óf entry+stop beide gevuld (stop <> entry);
--     target/exit zijn optioneel bovenop een geldige entry+stop.
--   * Richting-consistentie: Long ⇒ stop < entry, Short ⇒ stop > entry —
--     een SL aan de verkeerde kant is de stille R-corruptor (plan F2a).
--   * exit_price is de haak voor F5 (close-from-chart); nu altijd null.
--
-- Share-RPC-beslissing (plan §2.1): get_shared_journal/get_shared_review
-- hebben een expliciete allow-list en worden bewust NIET uitgebreid — een
-- gedeelde coach-link toont %/R-resultaten, geen absolute prijsniveaus.
-- Heroverwegen kan later zonder migratie (create or replace).
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0058_trade_prices.sql
-- =========================================================

alter table trades add column if not exists entry_price  numeric(18,8);
alter table trades add column if not exists stop_price   numeric(18,8);
alter table trades add column if not exists target_price numeric(18,8);
alter table trades add column if not exists exit_price   numeric(18,8);

-- Prijzen zijn koersen: strikt positief waar gezet.
alter table trades drop constraint if exists trades_prices_positive_chk;
alter table trades add constraint trades_prices_positive_chk check (
  coalesce(entry_price, 1) > 0
  and coalesce(stop_price, 1) > 0
  and coalesce(target_price, 1) > 0
  and coalesce(exit_price, 1) > 0
);

-- Set-regel: alles leeg, óf een bruikbaar entry+stop-paar (target/exit optioneel).
alter table trades drop constraint if exists trades_prices_pair_chk;
alter table trades add constraint trades_prices_pair_chk check (
  (entry_price is null and stop_price is null and target_price is null and exit_price is null)
  or (entry_price is not null and stop_price is not null and stop_price <> entry_price)
);

-- Richting-consistentie (alleen afdwingbaar als beide bekend zijn).
alter table trades drop constraint if exists trades_prices_direction_chk;
alter table trades add constraint trades_prices_direction_chk check (
  entry_price is null
  or direction is null
  or (direction = 'Long'  and stop_price < entry_price)
  or (direction = 'Short' and stop_price > entry_price)
);

-- Registratie (runner doet dit ook; on conflict dekt de SQL-editor-route, 0057-conventie).
insert into schema_migrations (filename) values ('0058_trade_prices.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- kolommen bestaan (verwacht: 4 rijen, numeric):
--   select column_name, data_type, numeric_precision, numeric_scale
--     from information_schema.columns
--     where table_name = 'trades' and column_name in
--       ('entry_price','stop_price','target_price','exit_price');
--   -- checks bestaan (verwacht: 3 rijen):
--   select conname from pg_constraint
--     where conrelid = 'trades'::regclass and conname like 'trades_prices%';
--   -- registry (verwacht: 1 rij):
--   select filename from schema_migrations where filename = '0058_trade_prices.sql';
--   -- share-RPC ongewijzigd (verwacht: false — geen prijs in de body):
--   select prosrc like '%entry_price%' from pg_proc where proname = 'get_shared_journal';
-- =========================================================
