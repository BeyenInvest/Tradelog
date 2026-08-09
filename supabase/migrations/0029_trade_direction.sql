-- =========================================================
-- Beyen Invest — migration 0029: trade direction (Long/Short) — Scope C, cyclus 5
--
-- Adds the last missing universal-core field: direction. Every trader records
-- whether a trade was long or short, but Beyen never had it (design doc §2.1).
-- Real column for everyone (like outcome/pair), NOT a custom field.
--
-- Non-intrusive & additive: nullable, so the 194 existing trades stay valid
-- (direction unknown = null). The form/filter/analysis start using it; nothing
-- that exists breaks. The CSV importer maps buy->Long / sell->Short.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0029_trade_direction.sql
-- =========================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'direction_enum') then
    create type direction_enum as enum ('Long', 'Short');
  end if;
end $$;

alter table trades add column if not exists direction direction_enum;
