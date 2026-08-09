-- =========================================================
-- Beyen Invest — migration 0026: rename the built-in methodology
--
-- The built-in template + any personal fork of it were named "Archer" — a real
-- trading-education company. The trading *framework* it encodes (weekly analysis,
-- phases, zones) is generic and stays, but the brand name must not appear in the
-- product. This renames every methodology row still called "Archer" to a neutral,
-- descriptive name. Nothing keys on the name (references use the fixed uuid), so
-- this is display-only and non-intrusive. Visibility is unchanged: the built-in
-- template stays is_system / world-readable so anyone can still pick it.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0026_rename_methodology.sql
-- =========================================================

update methodologies set naam = 'Weekly Phase Method' where naam = 'Archer';
