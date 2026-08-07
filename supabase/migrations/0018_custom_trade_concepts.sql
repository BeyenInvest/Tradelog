-- =========================================================
-- Beyen Invest — migration: per-user custom "Trade concept" options
--
-- Same story as 0010_custom_entries.sql, now for the "Trade concept" field.
-- Some account holders trade concepts outside the fixed TRADE_CONCEPTS list
-- (constants.ts) and don't want their own extra values added to the shared
-- list everyone else sees. `custom_options` (created in 0010) already stores
-- per-user extra values per form field — this migration just wires the
-- 'trade_concept' field up to it and frees the column to hold those values.
--
-- `trades.trade_concept` moves off the native `trade_concept_enum` to plain
-- `text` because a Postgres enum type is fixed at the database level and
-- can't hold per-user values — the same deliberate, narrow exception to the
-- project's "one shared enum, no free text" rule already made for `entry`.
-- The <select> in EntrySection.tsx (fixed TRADE_CONCEPTS list + that user's
-- own custom_options rows for field='trade_concept') stays the only way to
-- set it from the UI.
--
-- No dedicated RLS needed for the column change (existing trades_owner_all
-- policy already covers it); custom_options already has its owner-only policy.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

alter table trades alter column trade_concept type text using trade_concept::text;
drop type trade_concept_enum;
