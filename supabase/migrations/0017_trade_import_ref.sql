-- =========================================================
-- Beyen Invest — migration: broker-import dedup reference
--
-- Fase 2 (adoptie), item 2 — broker-CSV import. Every imported trade carries a
-- stable reference to the broker deal it came from ("{broker}:{ticket}", e.g.
-- "ctrader:123456789" or "mt:987654") so re-importing the same export file never
-- creates duplicates.
--
-- NULL for every manually-entered trade (the vast majority) — the column only
-- exists to make imports idempotent. The partial unique index enforces one row
-- per (user, deal) but ignores NULLs, so hand-entered trades are unaffected and
-- two different users can never collide.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

alter table trades add column import_ref text;

create unique index trades_user_import_ref_unique
  on trades(user_id, import_ref)
  where import_ref is not null;
