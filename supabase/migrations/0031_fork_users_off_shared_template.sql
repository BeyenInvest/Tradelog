-- =========================================================
-- Beyen Invest — migration 0031: fork existing users off the shared WPM template
--                                 (Scope C, cyclus 3b — legacy data cleanup)
--
-- WHY. Since 0020, profiles.methodology_id defaulted to the world-readable,
-- read-only is_system "Weekly Phase Method" TEMPLATE (…0001), and existing users
-- were never forked off it — so their real trades / reviews / accounts were
-- written directly onto that SHARED template. Cyclus 3b's journal switcher lists
-- only a user's OWN journals, so the template (and all data stranded on it) is
-- unreachable: a user who switches to another journal can never switch back.
--
-- FIX. For every user with data on the template — or whose profile still points at
-- it — create a user-owned fork of the template (same fields, via the same
-- copy+show_when-remap as fork_methodology / 0024), move that user's trades,
-- reviews and accounts from the template onto their fork, and repoint their profile
-- if it still used the template as the active journal. Afterwards no user uses the
-- is_system template as a live journal (it stays a pickable preset only), and each
-- user's "Weekly Phase Method" journal shows up in their switcher with its data.
--
-- Idempotent / re-runnable: once a user's rows are moved off the template and the
-- profile repointed, the driving set is empty, so a second run is a no-op (it will
-- NOT mint duplicate forks).
--
-- Trade↔weekly-review links are preserved: trades keep their weekly_review_id and
-- the matching reviews move to the same fork, so the FK links stay intact. The
-- per-journal unique indexes (0030) can't collide — each fork is brand new/empty.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0031_fork_users_off_shared_template.sql
-- =========================================================

do $$
declare
  tmpl uuid := '00000000-0000-4000-8000-000000000001'; -- the is_system WPM template
  u record;
  new_meth uuid;
begin
  for u in
    select distinct uid from (
      select user_id as uid from trades           where methodology_id = tmpl
      union select user_id from weekly_reviews    where methodology_id = tmpl
      union select user_id from periodic_reviews  where methodology_id = tmpl
      union select user_id from prop_accounts     where methodology_id = tmpl
      union select id      from profiles          where methodology_id = tmpl
    ) s
    where uid is not null
  loop
    -- 1. Fork the template into a user-owned "Weekly Phase Method" journal
    --    (methodology row + all fields, remapping self-ref show_when by field_key).
    insert into methodologies (user_id, naam, is_system, asset_class, instrument_config)
    select u.uid, naam, false, asset_class, instrument_config
    from methodologies where id = tmpl
    returning id into new_meth;

    insert into methodology_fields
      (methodology_id, fase_id, field_key, label, field_type, options, is_computed,
       group_label, required, show_when_values, sort_order)
    select new_meth, null, field_key, label, field_type, options, is_computed,
           group_label, required, show_when_values, sort_order
    from methodology_fields where methodology_id = tmpl;

    update methodology_fields nf
    set show_when_field_id = np.id
    from methodology_fields sf
    join methodology_fields sp on sp.id = sf.show_when_field_id
    join methodology_fields np on np.methodology_id = new_meth and np.field_key = sp.field_key
    where sf.methodology_id = tmpl
      and nf.methodology_id = new_meth
      and nf.field_key = sf.field_key;

    -- 2. Move this user's data from the shared template onto their own fork.
    update trades           set methodology_id = new_meth where user_id = u.uid and methodology_id = tmpl;
    update weekly_reviews   set methodology_id = new_meth where user_id = u.uid and methodology_id = tmpl;
    update periodic_reviews set methodology_id = new_meth where user_id = u.uid and methodology_id = tmpl;
    update prop_accounts    set methodology_id = new_meth where user_id = u.uid and methodology_id = tmpl;

    -- 3. Repoint the active journal if it still used the shared template.
    update profiles set methodology_id = new_meth where id = u.uid and methodology_id = tmpl;
  end loop;
end $$;

-- ---------------------------------------------------------
-- Read-only verification (run manually after the migration):
--   -- nobody has live data on the is_system template anymore (expect 0 each):
--   select count(*)::int from trades          where methodology_id = '00000000-0000-4000-8000-000000000001';
--   select count(*)::int from weekly_reviews  where methodology_id = '00000000-0000-4000-8000-000000000001';
--   select count(*)::int from periodic_reviews where methodology_id = '00000000-0000-4000-8000-000000000001';
--   select count(*)::int from prop_accounts   where methodology_id = '00000000-0000-4000-8000-000000000001';
--   select count(*)::int from profiles        where methodology_id = '00000000-0000-4000-8000-000000000001';
--   -- each user now owns a WPM journal carrying their trades:
--   select p.email, m.naam, m.is_system,
--          (select count(*)::int from trades t where t.methodology_id = m.id and t.backtest_project_id is null) as live
--     from methodologies m join profiles p on p.id = m.user_id
--    where m.naam = 'Weekly Phase Method' and m.is_system = false order by live desc;
-- =========================================================
