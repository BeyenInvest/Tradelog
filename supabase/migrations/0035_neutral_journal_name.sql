-- =========================================================
-- Beyen Invest — migration 0035: neutrale default-journalnaam
--
-- handle_new_user() gaf elke nieuwe signup een journal met de hardcoded
-- Nederlandse naam 'Mijn journal' — die lekt NL in de EN-UI (een Engelstalige
-- gebruiker ziet meteen een Nederlands boek in de switcher). De trigger draait
-- in de DB en kent de UI-taal niet, dus we kiezen een taal-neutrale naam:
-- 'Journal' (identiek woord in NL/EN, en consistent met de switcher-fallback
-- journalSwitcher.unknown = "Journal"). De volwaardige onboarding (fase C) mag
-- dit later client-side hernoemen naar de voorkeur van de gebruiker.
--
-- Bestaande journals worden NIET hernoemd — alleen de default voor toekomstige
-- signups verandert. Idempotent: create or replace.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0035_neutral_journal_name.sql
-- =========================================================

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_meth uuid;
begin
  insert into public.methodologies (user_id, naam, is_system, asset_class)
  values (new.id, 'Journal', false, null)
  returning id into new_meth;

  insert into public.profiles (id, email, display_name, methodology_id)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name', new_meth);
  return new;
end;
$$;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   select prosrc from pg_proc where proname = 'handle_new_user';  -- bevat 'Journal', niet 'Mijn journal'
-- =========================================================
