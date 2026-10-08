-- 0064 — admin-leesrecht op de screenshots-bucket. Idempotent.
--
-- De admin-trade-popup (ReadOnlyTradeDetailModal → resolveScreenshotUrl) kon
-- andermans bucket-screenshots niet openen: createSignedUrl faalde stil op
-- storage-RLS — 0039 heeft alleen screenshots_select_own, terwijl alle
-- tabellen wél een admin-select-policy via is_admin() hebben. Read-only,
-- zelfde patroon: `to authenticated` is vereist zodat anon is_admin() nooit
-- evalueert (anon heeft sinds 0036 geen EXECUTE op is_admin(), dus geen
-- anon-lek). Extensie-snapshots zijn altijd bucket-paden, vandaar dat het
-- dáár opviel.

drop policy if exists "screenshots_select_admin" on storage.objects;
create policy "screenshots_select_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'screenshots' and is_admin());

-- Registratie (runner doet dit ook; on conflict dekt de SQL-editor-route, 0057-conventie).
insert into schema_migrations (filename) values ('0064_screenshots_admin_select.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- Verwacht: 1 rij, cmd = SELECT, roles = {authenticated}:
--   select policyname, cmd, roles from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and policyname = 'screenshots_select_admin';
--   -- Functionele check: als admin ingelogd in de app een trade-popup van een
--   -- ander lid openen — de screenshot-klik levert nu een werkende signed URL.
-- =========================================================
