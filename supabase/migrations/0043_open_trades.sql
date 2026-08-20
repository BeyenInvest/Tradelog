-- =========================================================
-- Beyen Invest — migration 0043: open / running trades
--
-- Lets a trade be logged while it's still running — before it has a realized
-- outcome. An open trade carries NO outcome/resultaat_pct yet; it's filled in
-- later when the trade is closed (edit → uncheck "loopt nog" → enter result).
--
-- Like a "Missed trade", an open trade must never dilute any realized number
-- (resultaat, win-rate, streaks, drawdown, equity, R). The exclusion is
-- enforced app-side through the closedTrades() helper in src/lib/stats/core.ts
-- (mirrors the isMissed()/takenTrades() contract), so the DB only needs to (a)
-- allow the null result and (b) keep the two states mutually exclusive.
--
--   trades.is_open  = true  → outcome/resultaat_pct MUST be null (still running)
--                   = false → outcome/resultaat_pct MUST be set  (closed, as before)
--
-- Existing rows all default to is_open = false and already have a non-null
-- outcome + resultaat_pct, so they satisfy the check with no backfill.
--
-- Idempotent / re-runnable: add-column-if-not-exists, drop-not-null is a no-op
-- the second time, and the check constraint is dropped-then-added.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0043_open_trades.sql
-- =========================================================

alter table trades add column if not exists is_open boolean not null default false;

-- An open trade has no realized result yet — these two columns become nullable,
-- gated by the check below so a *closed* trade still can't omit them.
alter table trades alter column outcome drop not null;
alter table trades alter column resultaat_pct drop not null;

alter table trades drop constraint if exists trades_open_result_chk;
alter table trades add constraint trades_open_result_chk check (
  (is_open and outcome is null and resultaat_pct is null)
  or (not is_open and outcome is not null and resultaat_pct is not null)
);

-- An open trade carries no post-close metadata yet: no execution grade, and in
-- particular it can never be a "Missed trade" (a hypothetical setup you *didn't*
-- take is the opposite of a live position still running). trade_evaluation is a
-- self-assessment made after the trade completes, so it stays null while open.
-- (The form already nulls it; this makes the two states mutually exclusive at the
-- DB level, which the TypeScript types can't express.)
alter table trades drop constraint if exists trades_open_no_eval_chk;
alter table trades add constraint trades_open_no_eval_chk check (
  not is_open or trade_evaluation is null
);

-- ---------------------------------------------------------
-- Server-side aggregations: exclude open trades the same way they exclude
-- missed trades, so a stray open row can never leak into a summed number.
-- (Backtest projects can't hold open trades — the "loopt nog" toggle is live-
-- journal only — so this is defense-in-depth for get_project_trade_summaries;
-- for the share RPC it's load-bearing: an open trade would otherwise arrive at
-- the anonymous viewer with a null outcome and break its client-side stats.)
-- ---------------------------------------------------------

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
    and not t.is_open
  group by t.backtest_project_id;
$$;

revoke execute on function get_project_trade_summaries() from public, anon;
grant execute on function get_project_trade_summaries() to authenticated;

create or replace function get_shared_journal(share_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'journal_name', m.naam,
    'display_name', p.display_name,
    'result_unit', p.result_unit,
    'hide_fase', p.hide_fase,
    'trades', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', t.id,
          'fase', t.fase,
          'datum_open', t.datum_open,
          'datum_sluiting', t.datum_sluiting,
          'duur_dagen', t.duur_dagen,
          'pair', t.pair,
          'instrument', t.instrument,
          'direction', t.direction,
          'outcome', t.outcome,
          'resultaat_pct', t.resultaat_pct,
          'risk_pct', t.risk_pct,
          'trade_evaluation', t.trade_evaluation,
          'weekly_criteria', t.weekly_criteria,
          'weekly_kenmerk', t.weekly_kenmerk,
          'trade_concept', t.trade_concept,
          'entry', t.entry,
          'cc', t.cc,
          'sessie', t.sessie,
          'nieuws', t.nieuws,
          'w_confirm', t.w_confirm,
          'd_confirm', t.d_confirm,
          'h4_confirm', t.h4_confirm,
          'w_screenshot', case when t.w_screenshot ~* '^https?://' then t.w_screenshot end,
          'd_screenshot', case when t.d_screenshot ~* '^https?://' then t.d_screenshot end,
          'h4_screenshot', case when t.h4_screenshot ~* '^https?://' then t.h4_screenshot end,
          'h2_screenshot', case when t.h2_screenshot ~* '^https?://' then t.h2_screenshot end,
          'extra_d_conf', t.extra_d_conf,
          'notes', t.notes,
          'fase1_daily_respecteert_zone', t.fase1_daily_respecteert_zone,
          'fase1_spelers_verleden', t.fase1_spelers_verleden,
          'fase2_daily_respecteert_zone', t.fase2_daily_respecteert_zone,
          'fase2_structuur', t.fase2_structuur,
          'fase3_zone_min_2_touches', t.fase3_zone_min_2_touches,
          'fase3_engulfing_candle', t.fase3_engulfing_candle,
          'fase3_beide', t.fase3_beide,
          'fase3_structuur', t.fase3_structuur,
          'fase4_weekly_bevestigingscandle', t.fase4_weekly_bevestigingscandle,
          'weekly_review_id', t.weekly_review_id,
          'backtest_project_id', t.backtest_project_id,
          'methodology_id', t.methodology_id,
          'custom', t.custom,
          'created_at', t.created_at,
          'updated_at', t.updated_at
        ) order by t.datum_open, t.id)
        from trades t
        where t.user_id = l.user_id
          and t.backtest_project_id is null
          and t.methodology_id is not distinct from l.methodology_id
          and t.trade_evaluation is distinct from 'Missed trade'
          and not t.is_open
      ),
      '[]'::jsonb
    )
  )
  from share_links l
  join profiles p on p.id = l.user_id
  left join methodologies m on m.id = l.methodology_id and m.user_id = l.user_id
  where l.token = share_token
    and l.scope = 'journal'
    and not l.revoked
    and (l.expires_at is null or l.expires_at > now());
$$;

revoke execute on function get_shared_journal(text) from public;
grant execute on function get_shared_journal(text) to anon, authenticated;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   select is_open, count(*) from trades group by is_open;               -- open vs gesloten
--   -- deze drie moeten 0 rijen geven (check constraints doen hun werk):
--   select id from trades where is_open and (outcome is not null or resultaat_pct is not null);
--   select id from trades where not is_open and (outcome is null or resultaat_pct is null);
--   select id from trades where is_open and trade_evaluation is not null;   -- geen open + evaluatie/missed
-- =========================================================
