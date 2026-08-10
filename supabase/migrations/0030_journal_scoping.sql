-- =========================================================
-- Beyen Invest — migration 0030: journal scoping (Scope C, cyclus 3b)
--
-- Makes each journal (= methodology, optie B) a fully ISOLATED book: trades,
-- reviews AND accounts belong to exactly one journal, and every stat/list scopes
-- to the active journal (profiles.methodology_id). Chosen isolation scope:
-- trades + analysis + reviews + accounts (backtest projects stay orthogonal).
--
-- Four parts:
--   1. Re-home existing LIVE trades onto each user's ACTIVE journal. They were
--      backfilled onto the Weekly Phase Method *template* in 0020, but the active
--      journal is the user's *fork* — without this, scoping would hide them all.
--   2. Add methodology_id to weekly_reviews / periodic_reviews / prop_accounts
--      (nullable, on delete set null — mirrors trades.methodology_id) and backfill
--      each existing row to its user's active journal.
--   3. Widen the reviews' uniqueness to be per-journal, so two journals can each
--      hold e.g. a week-1 or a January review.
--   4. Teach the two weekly-review auto-link triggers to match on methodology_id,
--      so a review only ever links its OWN journal's trades.
--
-- Non-intrusive for a single-journal user (the owner): everything they have is
-- re-homed onto their one active journal, so nothing disappears — verify with the
-- read-only checks at the bottom after running.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0030_journal_scoping.sql
-- =========================================================

-- ---------------------------------------------------------
-- 1. Re-home existing LIVE trades onto each user's active journal.
--    Project trades (backtest_project_id is not null) are orthogonal — untouched.
-- ---------------------------------------------------------
update trades t
   set methodology_id = p.methodology_id
  from profiles p
 where t.user_id = p.id
   and t.backtest_project_id is null
   and p.methodology_id is not null
   and t.methodology_id is distinct from p.methodology_id;

-- ---------------------------------------------------------
-- 2. Journal column on reviews + accounts, backfilled to the active journal.
-- ---------------------------------------------------------
alter table weekly_reviews   add column if not exists methodology_id uuid references methodologies(id) on delete set null;
alter table periodic_reviews add column if not exists methodology_id uuid references methodologies(id) on delete set null;
alter table prop_accounts    add column if not exists methodology_id uuid references methodologies(id) on delete set null;

update weekly_reviews r   set methodology_id = p.methodology_id from profiles p where r.user_id = p.id and r.methodology_id is null and p.methodology_id is not null;
update periodic_reviews r set methodology_id = p.methodology_id from profiles p where r.user_id = p.id and r.methodology_id is null and p.methodology_id is not null;
update prop_accounts a    set methodology_id = p.methodology_id from profiles p where a.user_id = p.id and a.methodology_id is null and p.methodology_id is not null;

create index if not exists idx_weekly_reviews_methodology   on weekly_reviews(methodology_id);
create index if not exists idx_periodic_reviews_methodology on periodic_reviews(methodology_id);
create index if not exists idx_prop_accounts_methodology    on prop_accounts(methodology_id);

-- ---------------------------------------------------------
-- 3. Per-journal uniqueness for reviews. A week/month review is unique within a
--    journal, not across a user's whole account. methodology_id may be null
--    (unassigned journal) — a partial index keeps those out of the constraint so
--    it never blocks a legacy null row, while journals are enforced when set.
-- ---------------------------------------------------------
alter table weekly_reviews drop constraint if exists weekly_reviews_user_id_jaar_week_nummer_key;
create unique index if not exists weekly_reviews_journal_week_unique
  on weekly_reviews(user_id, methodology_id, jaar, week_nummer)
  where methodology_id is not null;

drop index if exists periodic_reviews_month_quarter_unique;
drop index if exists periodic_reviews_year_unique;
create unique index periodic_reviews_month_quarter_unique
  on periodic_reviews(user_id, methodology_id, period_type, jaar, periode_nummer)
  where periode_nummer is not null and methodology_id is not null;
create unique index periodic_reviews_year_unique
  on periodic_reviews(user_id, methodology_id, jaar)
  where period_type = 'year' and methodology_id is not null;

-- ---------------------------------------------------------
-- 4. Journal-aware auto-linking. A weekly review and a trade only link when they
--    share a journal, so switching journals never blends one book's trades into
--    another book's review of the same ISO week.
-- ---------------------------------------------------------
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
      where user_id = new.user_id
        and methodology_id is not distinct from new.methodology_id
        and jaar = iso_year and week_nummer = iso_week
      limit 1;
    new.weekly_review_id := found_id;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function link_weekly_review_to_trades() returns trigger as $$
begin
  update trades
    set weekly_review_id = new.id
    where user_id = new.user_id
      and backtest_project_id is null
      and methodology_id is not distinct from new.methodology_id
      and weekly_review_id is null
      and extract(isoyear from datum_open) = new.jaar
      and extract(week from datum_open) = new.week_nummer;
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------
-- Read-only verification (run manually after the migration):
--   -- every live trade now sits on its user's active journal (expect 0):
--   select count(*) from trades t join profiles p on p.id = t.user_id
--     where t.backtest_project_id is null and t.methodology_id is distinct from p.methodology_id;
--   -- reviews/accounts all assigned (expect 0 each, for users with an active journal):
--   select count(*) from weekly_reviews r join profiles p on p.id = r.user_id where r.methodology_id is null and p.methodology_id is not null;
--   select count(*) from periodic_reviews r join profiles p on p.id = r.user_id where r.methodology_id is null and p.methodology_id is not null;
--   select count(*) from prop_accounts a join profiles p on p.id = a.user_id where a.methodology_id is null and p.methodology_id is not null;
-- =========================================================
