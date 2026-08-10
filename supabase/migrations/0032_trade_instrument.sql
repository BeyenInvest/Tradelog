-- =========================================================
-- Beyen Invest — migration 0032: free instrument field (Scope C, cyclus 7 — multi-asset)
--
-- Today `pair` is a forex-only enum (pair_enum). A stocks/crypto/futures journal
-- can't log its real symbol (AAPL, BTC, ES). This adds a free-text `instrument`
-- column: the universal "what did you trade" field for every asset class.
--
-- Non-intrusive & additive: `pair` stays (not null, forex enum) and keeps driving
-- the forex-only analysis (currency split, lot calc). A forex journal mirrors
-- instrument = pair; a non-forex journal writes its free symbol into instrument and
-- leaves pair on a harmless default (same hidden-default trick as cc/fase in optie A).
-- Existing trades are all forex, so backfill instrument = pair.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0032_trade_instrument.sql
-- =========================================================

alter table trades add column if not exists instrument text;

-- Backfill: every existing trade is forex, so its instrument is its pair.
update trades set instrument = pair::text where instrument is null;
