-- =========================================================
-- Beyen Invest — migration: weekly reviews link live trades only
--
-- Bug: link_trade_to_weekly_review() fired for every inserted trade, including
-- backtest project trades. A backtest trade whose datum_open happened to fall
-- in a week that already had a weekly review got that review's id stamped on
-- it — silently mixing isolated backtest data into a live Journal review.
-- The UI never showed it (every review view reads live-scoped trades), so the
-- corruption is invisible but real, and it breaks the isolation guarantee the
-- whole backtest-project model rests on.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

-- ---------- 1. stop the trigger from linking backtest trades ----------
create or replace function link_trade_to_weekly_review() returns trigger as $$
declare
  iso_year int;
  iso_week int;
  found_id uuid;
begin
  -- backtest_project_id is not null => project trade, never belongs to a weekly review
  if new.weekly_review_id is null and new.backtest_project_id is null then
    iso_year := extract(isoyear from new.datum_open);
    iso_week := extract(week from new.datum_open);
    select id into found_id from weekly_reviews
      where user_id = new.user_id and jaar = iso_year and week_nummer = iso_week
      limit 1;
    new.weekly_review_id := found_id;
  end if;
  return new;
end;
$$ language plpgsql;

-- ---------- 2. clean up rows already mis-linked ----------
-- Safe to re-run: only touches project trades that carry a weekly_review_id.
update trades
  set weekly_review_id = null
  where backtest_project_id is not null
    and weekly_review_id is not null;
