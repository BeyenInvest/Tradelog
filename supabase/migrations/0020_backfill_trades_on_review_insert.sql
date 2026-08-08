-- =========================================================
-- Beyen Invest — migration: auto-link existing trades when a weekly review is created
--
-- Bug: link_trade_to_weekly_review() only fires BEFORE INSERT on trades, so it
-- links in one direction only (new trade -> existing review). A review created
-- AFTER its week's trades already exist never picked them up automatically —
-- they stayed unlinked until someone hit the manual "relink" button. Result:
-- reviews silently showing fewer linked trades than actually happened that week
-- (e.g. a review with a linked "missed trade" added later, but the real taken
-- trades from earlier in the week missing).
--
-- Fix: mirror the trade-insert trigger with a review-insert trigger that
-- backfills the week's existing live trades, plus a one-time backfill for
-- reviews that already exist.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

-- ---------- 1. link existing week trades when a review is created ----------
-- Only touches live trades (backtest_project_id is null) that aren't already
-- linked, matched by the same ISO year/week logic the trade-insert trigger uses.
create or replace function link_weekly_review_to_trades() returns trigger as $$
begin
  update trades
    set weekly_review_id = new.id
    where user_id = new.user_id
      and backtest_project_id is null
      and weekly_review_id is null
      and extract(isoyear from datum_open) = new.jaar
      and extract(week from datum_open) = new.week_nummer;
  return new;
end;
$$ language plpgsql;

create trigger trg_link_weekly_review_trades
  after insert on weekly_reviews
  for each row execute function link_weekly_review_to_trades();

-- ---------- 2. backfill reviews that already exist ----------
-- Idempotent: only fills unlinked live trades that have a matching review.
update trades t
  set weekly_review_id = wr.id
  from weekly_reviews wr
  where t.user_id = wr.user_id
    and t.backtest_project_id is null
    and t.weekly_review_id is null
    and extract(isoyear from t.datum_open) = wr.jaar
    and extract(week from t.datum_open) = wr.week_nummer;
