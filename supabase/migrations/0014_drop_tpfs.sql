-- =========================================================
-- Beyen Invest — migration: drop the tpfs_pct column
--
-- TPFS (TP on First Structure) was a hypothetical, parallel result logged per
-- trade and shown only as a supplementary block in the Backtesting analysis. It
-- has been removed from the product entirely (form field, stats module, UI, and
-- types), so the underlying column is now dead. Dropping it here keeps the
-- schema in sync with schema.sql.
--
-- Destructive: this permanently removes any stored TPFS values. No other column
-- or view depended on it. No RLS change needed.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

alter table trades drop column if exists tpfs_pct;
