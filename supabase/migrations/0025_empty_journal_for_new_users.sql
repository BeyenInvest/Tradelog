-- =========================================================
-- Beyen Invest — migration 0025: new users get their own EMPTY journal
--                                (Scope C, cyclus 1b — plak 3)
--
-- The last slice of 1b: it takes "fase" definitively out of the universal core
-- for new users. Until now every new signup silently inherited the Weekly Phase Method system
-- template (via the profiles.methodology_id column default). Weekly Phase Method's 4-fasen
-- backbone is a preset, not the norm — so a fresh, non-Weekly Phase Method user must start
-- from an EMPTY journal and build their own fields on /settings, rather than be
-- handed Weekly Phase Method's fases.
--
-- Non-intrusive:
--   * The owner + all existing users keep pointing at Weekly Phase Method (their rows are
--     untouched — dropping a column default never rewrites existing rows).
--   * The Weekly Phase Method template stays a world-readable system preset anyone can pick.
--   * Public signup is still gated off (README §5), so this is forward-looking:
--     it changes what the FIRST real signup will get, nothing that exists today.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0025_empty_journal_for_new_users.sql
-- =========================================================

-- 1. Stop silently defaulting new profiles to the Weekly Phase Method template. From now on
--    handle_new_user() sets methodology_id explicitly (below); no hidden default
--    can ever re-impose Weekly Phase Method on a fresh account.
alter table profiles alter column methodology_id drop default;

-- 2. Provision a fresh, empty, user-owned methodology (journal) per signup and
--    point the new profile at it. is_system = false → the user owns it and can
--    edit its fields directly (no fork needed). asset_class stays null (blank);
--    the user picks an asset/preset later (cyclus 3b/6). No fields are seeded —
--    an empty journal is the whole point.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_meth uuid;
begin
  insert into public.methodologies (user_id, naam, is_system, asset_class)
  values (new.id, 'Mijn journal', false, null)
  returning id into new_meth;

  insert into public.profiles (id, email, display_name, methodology_id)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name', new_meth);
  return new;
end;
$$;
