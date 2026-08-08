-- =========================================================
-- Beyen Invest — migration: server-side per-project trade summaries
--
-- Fase 2 (schaalbaarheid), item 1c. The backtesting projects list previously
-- pulled EVERY project trade to the client (select backtest_project_id,outcome,
-- resultaat_pct across all projects) purely to render each card's "n trades /
-- +x%" summary, then aggregated in JS. This RPC does that aggregation in the
-- database and returns ONE row per project instead of every trade — the one
-- place in the app where server-side aggregation is a clean win with no
-- interactivity to regress.
--
-- Mirrors computeOutcomeCounts() in src/lib/stats/core.ts:
--   n              = count of taken trades
--   wins/losses/be = per-outcome counts
--   resultaat_total = round(sum(resultaat_pct), 2)
-- resultaat_pct is numeric(7,2), so the sum is already exact to 2 decimals and
-- round() only guards formatting — matching round2()'s intent client-side.
--
-- Missed trades are excluded (`is distinct from 'Missed trade'`, which correctly
-- keeps NULL evaluations) to honour the shared missed-trade contract. Backtest
-- projects can't actually hold missed trades (ResultSection hides that field
-- outside the live Journal), so this never changes a visible number — it just
-- keeps the rule enforced server-side too.
--
-- SECURITY INVOKER (the default) so the caller's RLS still applies; the explicit
-- user_id = auth.uid() filter additionally stops an admin's blanket read-all
-- policy (0008_admin_role.sql) from summing every user's projects here, exactly
-- like the explicit filter in useTrades' refresh().
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

create or replace function get_project_trade_summaries()
returns table (
  backtest_project_id uuid,
  n integer,
  wins integer,
  losses integer,
  be integer,
  resultaat_total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.backtest_project_id,
    count(*)::int,
    count(*) filter (where t.outcome = 'Win')::int,
    count(*) filter (where t.outcome = 'Loss')::int,
    count(*) filter (where t.outcome = 'BE')::int,
    round(coalesce(sum(t.resultaat_pct), 0), 2)
  from trades t
  where t.backtest_project_id is not null
    and t.user_id = auth.uid()
    and t.trade_evaluation is distinct from 'Missed trade'
  group by t.backtest_project_id;
$$;

-- Lock execution to signed-in users. Postgres grants EXECUTE to PUBLIC by default,
-- which would let the anon role call this too; SECURITY INVOKER + the auth.uid()
-- filter already return nothing for anon, but keep the grant explicit and matching
-- schema.sql. Safe to re-run — revoke/grant are idempotent.
revoke all on function get_project_trade_summaries() from public;
grant execute on function get_project_trade_summaries() to authenticated;
