-- =========================================================
-- Beyen Invest — migration 0037: resultaat-eenheid per gebruiker (Fase J)
--
-- profiles.result_unit: hoe deze gebruiker resultaten getoond wil zien —
-- 'percent' (huidig gedrag), 'R' (R-multiples) of 'currency' (geld).
-- Puur een weergave-voorkeur: alle opslag en alle stats blijven in %
-- (resultaat_pct); de conversie gebeurt uitsluitend in de frontend.
-- Default 'percent' — niets verandert voor bestaande gebruikers.
--
-- Keuze-UI op /settings, achter beta_features (gating-regel).
--
-- Idempotent / re-runnable: enum via duplicate_object-guard, add column if
-- not exists.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0037_result_unit.sql
-- =========================================================

do $$ begin
  create type result_unit_enum as enum ('percent','R','currency');
exception
  when duplicate_object then null;
end $$;

alter table profiles add column if not exists result_unit result_unit_enum not null default 'percent';

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   select email, result_unit from profiles order by created_at;  -- iedereen 'percent'
-- =========================================================
