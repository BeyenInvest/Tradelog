-- =========================================================
-- Beyen Invest — migration: admin role + read-only admin RLS carve-out
--
-- Gives the app owner a way to inspect another user's data (trades,
-- reviews, projects, accounts) for debugging reported bugs, and lays the
-- groundwork a future coaching feature would also need. Deliberately
-- READ-ONLY: admins get an additional SELECT policy on every user-data
-- table, nothing else. No mutation rights, no service-role key, no edge
-- function — the whole app is client-only against the anon key, so a
-- role column + RLS carve-out is the standard Supabase pattern here
-- rather than standing up new server-side infra for a solo-owner app.
--
-- `is_admin()` is SECURITY DEFINER for the same reason as
-- delete_own_account() (schema.sql): the calling client's JWT alone can't
-- safely read another admin-check row without RLS recursion, so this runs
-- with elevated privileges, scoped tightly to a single boolean read.
--
-- Postgres OR's multiple permissive RLS policies together, so every policy
-- below is purely additive — none of the existing owner-only policies
-- change.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

alter table profiles
  add column role text not null default 'user' check (role in ('user', 'admin'));

create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

revoke all on function is_admin() from public;
grant execute on function is_admin() to authenticated;

create policy "profiles_admin_select" on profiles
  for select using (is_admin());
create policy "trades_admin_select" on trades
  for select using (is_admin());
create policy "weekly_reviews_admin_select" on weekly_reviews
  for select using (is_admin());
create policy "periodic_reviews_admin_select" on periodic_reviews
  for select using (is_admin());
create policy "backtest_projects_admin_select" on backtest_projects
  for select using (is_admin());
create policy "prop_accounts_admin_select" on prop_accounts
  for select using (is_admin());
create policy "payouts_admin_select" on payouts
  for select using (is_admin());

-- ---------- manual one-off, run by hand after the above, NOT part of this migration ----------
-- update profiles set role = 'admin' where email = '<owner email>';
