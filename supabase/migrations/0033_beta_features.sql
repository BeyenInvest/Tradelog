-- =========================================================
-- Beyen Invest — migration 0033: soft-launch beta-vlag + stragglers re-home
--
-- 1. profiles.beta_features: gate voor de zichtbare multi-journal UI
--    (journal-switcher, preset-picker, veld-editor, Richting-veld/-filter).
--    Default false — bestaande gebruikers zien na de merge naar main enkel de
--    bugfixes; alleen geflagde accounts (nu: de owner) zien het nieuwe. Bij de
--    publieke launch flipt dit voor iedereen (of de gates verdwijnen uit de code).
--    Geen UI-toggle — bewust alleen via SQL te zetten.
--
-- 2. Stragglers re-home: rijen die de OUDE frontend (main vóór deze merge)
--    sinds 0030 aanmaakte, kregen geen methodology_id gestampt (die frontend
--    kende de kolom niet) en zouden na de deploy uit de journal-gescopede views
--    verdwijnen. Zet ze alsnog op het actieve journal van hun eigenaar — ALLEEN
--    de null-rijen: rijen met een gezet journal (multi-journal-gebruik van de
--    owner) blijven waar ze staan.
--
-- Idempotent / re-runnable: add column if not exists + louter null-updates.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0033_beta_features.sql
-- =========================================================

alter table profiles add column if not exists beta_features boolean not null default false;

-- De owner ziet de beta-UI meteen.
update profiles set beta_features = true where email = 'superrrdun@gmail.com';

-- ---------------------------------------------------------
-- Stragglers van de oude frontend (sinds 0030) naar het actieve journal.
-- ---------------------------------------------------------
update trades t
   set methodology_id = p.methodology_id
  from profiles p
 where t.user_id = p.id
   and t.backtest_project_id is null
   and t.methodology_id is null
   and p.methodology_id is not null;

update weekly_reviews r   set methodology_id = p.methodology_id from profiles p where r.user_id = p.id and r.methodology_id is null and p.methodology_id is not null;
update periodic_reviews r set methodology_id = p.methodology_id from profiles p where r.user_id = p.id and r.methodology_id is null and p.methodology_id is not null;
update prop_accounts a    set methodology_id = p.methodology_id from profiles p where a.user_id = p.id and a.methodology_id is null and p.methodology_id is not null;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   select email, beta_features from profiles order by created_at;  -- alleen owner = true
--   -- geen live rijen meer zonder journal (verwacht 0, voor users met actief journal):
--   select count(*) from trades t join profiles p on p.id = t.user_id
--     where t.backtest_project_id is null and t.methodology_id is null and p.methodology_id is not null;
-- =========================================================
