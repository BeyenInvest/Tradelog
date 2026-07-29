-- =========================================================
-- Beyen Invest — migration: missed trades + periodic reviews
-- Paste into Supabase SQL editor and run once on the existing project.
-- =========================================================

-- ---------- Missed trades ----------
-- Adds a 4th trade_evaluation option. A "missed trade" is a setup you saw but
-- didn't take — still logged with the same fields (incl. a hypothetical
-- outcome/resultaat_pct) so it can be reviewed later, but excluded from the
-- live Journal's stats/calendar by default (app-side filter, not DB-side).
alter type trade_evaluation_enum add value 'Missed trade';

-- ---------- Periodic reviews (month/quarter/year) ----------
-- Weekly reviews keep their existing dedicated table/trigger — this is a
-- separate table for the coarser roll-up periods. No FK from trades: the
-- trades within a period are found by date range (datum_open), computed on
-- the fly with the same stats functions already used everywhere else.
create type period_type_enum as enum ('month', 'quarter', 'year');

create table periodic_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_type period_type_enum not null,
  jaar integer not null check (jaar between 2000 and 2100),
  periode_nummer integer, -- 1-12 for month, 1-4 for quarter, null for year
  titel text,
  technisch text,
  mentaal_owner text,
  mentaal_trader text,
  acties text[] not null default '{}',
  takeaway text,
  overall_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NULL isn't equal to NULL in a unique constraint, so "year" rows (where
-- periode_nummer is always null) need their own partial index to actually be
-- capped at one per year.
create unique index periodic_reviews_month_quarter_unique
  on periodic_reviews(user_id, period_type, jaar, periode_nummer)
  where periode_nummer is not null;
create unique index periodic_reviews_year_unique
  on periodic_reviews(user_id, jaar)
  where period_type = 'year';

create index idx_periodic_reviews_user on periodic_reviews(user_id);

alter table periodic_reviews enable row level security;

create policy "periodic_reviews_owner_all" on periodic_reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger trg_periodic_reviews_updated_at before update on periodic_reviews
  for each row execute function set_updated_at();
