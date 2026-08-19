-- =========================================================
-- Beyen Invest — migration: private `screenshots` storage bucket (Fase K)
--
-- Lets a user upload / paste a chart screenshot in the trade form instead of
-- only pasting an external URL. Files live in Supabase Storage under a per-user
-- folder (`{user_id}/...`); the `trades.*_screenshot` columns keep storing a
-- string — either an external URL (legacy / manual paste, starts with http) or
-- a storage path in this bucket (see isExternalUrl() in src/lib/storage).
--
-- Private bucket (public = false): the app never exposes a raw object URL, it
-- mints short-lived signed URLs on demand (resolveScreenshotUrl). Privacy-first,
-- per the handoff.
--
-- RLS: Supabase already enables RLS on storage.objects; we add four policies
-- scoped to `authenticated` only, keyed on the first path segment == auth.uid().
-- anon gets no policy at all (matches the "anon niets" hygiene of 0038).
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- =========================================================

-- 1. The bucket itself. 5 MB / trade screenshot is generous for a PNG chart.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screenshots',
  'screenshots',
  false,
  5242880, -- 5 * 1024 * 1024
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Per-user RLS on the objects in this bucket. `(storage.foldername(name))[1]`
--    is the first path segment — we require it to equal the caller's uid, so a
--    user can only ever touch files under their own `{user_id}/` prefix.
--    drop-then-create keeps this migration idempotent (CREATE POLICY has no
--    IF NOT EXISTS).

drop policy if exists "screenshots_select_own" on storage.objects;
create policy "screenshots_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "screenshots_insert_own" on storage.objects;
create policy "screenshots_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "screenshots_update_own" on storage.objects;
create policy "screenshots_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "screenshots_delete_own" on storage.objects;
create policy "screenshots_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
