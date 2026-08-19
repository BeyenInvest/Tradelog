-- =========================================================
-- Beyen Invest — migration: revoke anon EXECUTE on get_project_trade_summaries
--
-- The revoke/grant below was added to 0016_project_trade_summaries.sql on the
-- fase-j-geld-r branch, but 0016 had already been run on prod — and migrations
-- are applied per-file, once, by hand (Supabase SQL editor). Nothing in that
-- workflow re-runs an amended file, so prod would keep the direct anon EXECUTE
-- grant forever. This numbered migration carries the same statements through
-- the normal flow instead.
--
-- Context (see 0016): on Supabase, default privileges grant every new function
-- EXECUTE to anon/authenticated/service_role *directly*, so anon must be
-- revoked by name — a PUBLIC revoke alone is not enough (verified against prod
-- 2026-08-13: anon still got 200 [] with only the public revoke). The function
-- is SECURITY INVOKER with an auth.uid() filter, so anon gets an empty set
-- either way: this is hygiene, not a leak.
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- =========================================================

revoke execute on function get_project_trade_summaries() from public, anon;
grant execute on function get_project_trade_summaries() to authenticated;
