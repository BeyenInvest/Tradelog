-- =========================================================
-- Beyen Invest — migration: periodic review sub-period recap
--
-- Adds the one field monthly/quarterly/yearly reviews need that weekly
-- reviews don't: a free-text recap of the sub-periods inside this one
-- (e.g. a per-month write-up inside a quarterly review). Nullable/additive,
-- no backfill needed.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

alter table periodic_reviews add column periode_overzicht text;
