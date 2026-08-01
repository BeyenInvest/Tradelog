-- =========================================================
-- Beyen Invest — migration: self-service account deletion
--
-- Supports the "recht op verwijdering" (GDPR right to erasure) promised in
-- /privacy. The client's JWT has no delete rights on auth.users, so this
-- exposes a narrow SECURITY DEFINER function that only ever deletes the
-- calling user's own row (auth.uid(), never a parameter) — every other table
-- (profiles, trades, weekly_reviews, backtest_projects, prop_accounts,
-- payouts, periodic_reviews) cascades away via existing `on delete cascade`
-- FKs to auth.users(id), so nothing else needs to be touched here.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

create or replace function delete_own_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function delete_own_account() from public;
grant execute on function delete_own_account() to authenticated;
