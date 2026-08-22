-- =========================================================
-- Beyen Invest — migration: revoke anon EXECUTE on every RPC-callable function
--
-- Follow-up to the 0016 fix (get_project_trade_summaries). During Fase I we
-- learned that on Supabase `revoke all on function f() from public` is NOT
-- enough: the project's default privileges grant EXECUTE on every new
-- function *directly* to anon/authenticated/service_role, and a PUBLIC
-- revoke leaves those direct grants untouched. anon must be revoked by name.
--
-- Verified against prod 2026-08-13, all with only the anon key:
--   POST /rest/v1/rpc/is_admin          -> 200 false   (anon could execute)
--   POST /rest/v1/rpc/fork_methodology  -> 400 "not authenticated"
--                                          (the function RAN, proving the grant)
--   GET  /rest/v1/trades                -> 200 []      (baseline to preserve)
--
-- None of these were an actual data leak — every function is either
-- SECURITY INVOKER + RLS-bound or no-ops on auth.uid() = null — so this is
-- defense-in-depth hygiene, not an incident fix.
--
-- IS_ADMIN() NEEDS CARE (the one non-obvious part of this migration):
-- is_admin() is referenced in the USING expression of the 7 admin-select
-- RLS policies (0008_admin_role.sql). Those policies had no TO clause, so
-- they apply to ALL roles — including anon — and RLS policy expressions are
-- evaluated with the querying role's privileges. Revoking anon's EXECUTE on
-- is_admin() alone would therefore turn every anon SELECT on those tables
-- from "200 []" into "permission denied for function is_admin" (42501).
-- Fix: first restrict the admin policies to authenticated (anon then never
-- evaluates is_admin() at all — behavior for anon is unchanged, the owner
-- policies' auth.uid() = null already returns zero rows), THEN revoke.
-- Keep this order if the script is ever run statement-by-statement.
--
-- DELIBERATELY LEFT ALONE:
--   * Trigger functions (set_updated_at, trades_set_sessie,
--     profiles_recompute_sessie, handle_new_user, link_trade_to_weekly_review,
--     link_weekly_review_to_trades): they return `trigger`, which Postgres
--     refuses to call directly ("trigger functions can only be called as
--     triggers") and PostgREST does not expose over /rpc — anon's grant on
--     them is inert. handle_new_user in particular fires under
--     supabase_auth_admin during signup; touching its ACL risks breaking
--     account creation for zero security gain.
--   * service_role keeps EXECUTE everywhere: it is the trusted server-side
--     key and bypasses RLS anyway.
--
-- Safe to re-run — every statement is idempotent.
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

-- 1) Admin read-only policies: evaluate only for signed-in users, so anon
--    never needs EXECUTE on is_admin(). Must run BEFORE the revoke below.
alter policy "profiles_admin_select" on profiles to authenticated;
alter policy "trades_admin_select" on trades to authenticated;
alter policy "weekly_reviews_admin_select" on weekly_reviews to authenticated;
alter policy "periodic_reviews_admin_select" on periodic_reviews to authenticated;
alter policy "backtest_projects_admin_select" on backtest_projects to authenticated;
alter policy "prop_accounts_admin_select" on prop_accounts to authenticated;
alter policy "payouts_admin_select" on payouts to authenticated;

-- 2) Revoke anon by name on every directly callable function.
revoke execute on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

revoke execute on function delete_own_account() from public, anon;
grant execute on function delete_own_account() to authenticated;

revoke execute on function fork_methodology(uuid) from public, anon;
grant execute on function fork_methodology(uuid) to authenticated;

-- Pure date-math helper, but callable over /rpc — same hygiene. The explicit
-- authenticated grant matters here: triggers (trades_set_sessie,
-- profiles_recompute_sessie) call it as the invoking signed-in user.
revoke execute on function compute_sessie(cc_enum, date, text) from public, anon;
grant execute on function compute_sessie(cc_enum, date, text) to authenticated;

-- Also covered by the updated 0016 — repeated here so this migration is a
-- complete audit on its own. Idempotent, harmless to run twice.
revoke execute on function get_project_trade_summaries() from public, anon;
grant execute on function get_project_trade_summaries() to authenticated;

-- =========================================================
-- Post-run verification (read-only, anon key only):
--   POST /rest/v1/rpc/is_admin                     -> 401, code 42501
--   POST /rest/v1/rpc/fork_methodology             -> 401, code 42501
--   POST /rest/v1/rpc/compute_sessie               -> 401, code 42501
--   POST /rest/v1/rpc/get_project_trade_summaries  -> 401, code 42501
--   GET  /rest/v1/trades?select=id&limit=1         -> still 200 []
--   (delete_own_account: same grant history; no anon probe — logged-in
--    smoke test of account deletion is not needed, the grant to
--    authenticated above is unchanged from 0006.)
-- =========================================================
