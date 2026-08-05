-- =========================================================
-- Beyen Invest — migration: per-user "fasen tonen" toggle
--
-- Some account holders don't use the fixed 4-fasen methodology at all.
-- `hide_fase` lets a user hide every fase-related field/breakdown from
-- their own UI without touching the data model — `trades.fase` stays
-- `not null` (existing rows, and any row inserted while hidden, keep
-- their default "Fase 1"), so no schema change is needed there and
-- nothing about the fixed 4-fasen system itself changes for anyone else.
--
-- No RLS change needed: `profiles_owner_update` (schema.sql) already lets
-- a user update their own profile row.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

alter table profiles
  add column hide_fase boolean not null default false;
