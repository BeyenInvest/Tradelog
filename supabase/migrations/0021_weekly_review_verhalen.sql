-- =========================================================
-- Beyen Invest — migration: weekly review "verhalen" section
--
-- Splits the market-narrative prompt ("Welke verhalen speelden er deze
-- week?") out of the Technisch field into its own dedicated section/column,
-- shown above Technisch in the weekly review form, detail view and PDF.
-- Weekly-only: periodic reviews repurpose the shared columns under different
-- labels and have no narrative prompt. Nullable/additive, no backfill needed.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

alter table weekly_reviews add column verhalen text;
