-- =========================================================
-- Beyen Invest — Supabase schema
-- Paste into Supabase SQL editor and run once (fresh project).
-- =========================================================
create extension if not exists pgcrypto;

-- ---------- ENUM TYPES ----------
create type fase_enum as enum ('Fase 1','Fase 2','Fase 3','Fase 4');
create type outcome_enum as enum ('Win','Loss','BE');
create type trade_evaluation_enum as enum ('Good trade','Emotional error','Technical error','Missed trade');
create type period_type_enum as enum ('month','quarter','year');
create type pair_enum as enum (
  'AUDCAD','AUDCHF','AUDJPY','AUDNZD','AUDUSD',
  'CADCHF','CADJPY','CHFJPY',
  'EURAUD','EURCAD','EURCHF','EURGBP','EURJPY','EURNZD','EURUSD',
  'GBPAUD','GBPCAD','GBPCHF','GBPJPY','GBPNZD','GBPUSD',
  'NZDCAD','NZDCHF','NZDJPY','NZDUSD',
  'USDCAD','USDCHF','USDJPY',
  'XAGUSD','XAUUSD'
);
create type weekly_criteria_enum as enum ('Pattern','High/Low','IC','Region');
create type weekly_kenmerk_enum as enum ('Trending market','Corrective market','Ranging market');
-- trade_concept intentionally has no enum type — it's plain text (fixed
-- TRADE_CONCEPTS list + per-user custom_options), same exception as `entry`
-- below. See 0018_custom_trade_concepts.sql / 0010_custom_entries.sql.
create type cc_enum as enum ('03','07','11','15','19','23');
create type sessie_enum as enum ('Asia','London','Overlap','New York');
create type structuur_enum as enum ('Inner','Outer');
create type prop_fase_enum as enum ('Phase 1','Phase 2','Funded','Private');

-- ---------- PROFILES ----------
-- 1:1 with auth.users, auto-provisioned by the trigger below. `plan` defaults
-- to 'free' as the hook point for a future billing integration — no billing
-- logic exists yet, this just avoids a backfill migration later.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  plan text not null default 'free',
  role text not null default 'user' check (role in ('user', 'admin')),
  hide_fase boolean not null default false,
  -- IANA timezone the user reads candle-close (cc) times in. Drives the
  -- timezone-aware `trades.sessie` mapping (see compute_sessie / 0019). Default
  -- is the reference zone the methodology was authored in.
  timezone text not null default 'Europe/Brussels',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- BACKTEST PROJECTS (created before trades — trades FK into it) ----------
-- A trade belongs to the live Journal when backtest_project_id IS NULL, or to
-- exactly one isolated backtest project when set — never both, never shared.
create table backtest_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  naam text not null,
  beschrijving text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- WEEKLY REVIEWS (created before trades — trades FK into it) ----------
create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_nummer integer not null check (week_nummer between 1 and 53),
  jaar integer not null check (jaar between 2000 and 2100),
  titel text,
  verhalen text,
  technisch text,
  mentaal_owner text,
  mentaal_trader text,
  acties text[] not null default '{}',
  takeaway text,
  overall_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, jaar, week_nummer)
);

-- ---------- PERIODIC REVIEWS (month/quarter/year — no FK from trades, period found by date range) ----------
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

create unique index periodic_reviews_month_quarter_unique
  on periodic_reviews(user_id, period_type, jaar, periode_nummer)
  where periode_nummer is not null;
create unique index periodic_reviews_year_unique
  on periodic_reviews(user_id, jaar)
  where period_type = 'year';

-- ---------- TRADES ----------
create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  fase fase_enum not null,
  datum_open date not null,
  datum_sluiting date,
  duur_dagen integer generated always as (datum_sluiting - datum_open) stored,

  pair pair_enum not null,
  outcome outcome_enum not null,
  resultaat_pct numeric(7,2) not null,
  -- Planned risk % the trade was taken with. NULL = the default 1% (DEFAULT_RISK_PCT),
  -- which keeps R ≡ resultaat_pct for everyone on the flat-1% workflow. See 0012_risk_pct.sql.
  risk_pct numeric(7,2) check (risk_pct > 0),
  trade_evaluation trade_evaluation_enum,

  weekly_criteria weekly_criteria_enum,
  weekly_kenmerk weekly_kenmerk_enum,
  trade_concept text, -- fixed TRADE_CONCEPTS list + per-user custom_options, not a native enum (see custom_options below)
  entry text, -- fixed ENTRIES list + per-user custom_options, not a native enum (see custom_options below)

  cc cc_enum not null,
  -- Timezone-aware trading session, derived from cc + datum_open + the owner's
  -- profiles.timezone. Maintained by trg_trades_set_sessie (not a generated
  -- column: the tz conversion isn't IMMUTABLE). See compute_sessie() and 0019.
  sessie sessie_enum not null,

  nieuws boolean not null default false,
  w_confirm boolean,
  d_confirm boolean,
  h4_confirm boolean,
  w_screenshot text,
  d_screenshot text,
  h4_screenshot text,
  h2_screenshot text,
  extra_d_conf boolean,

  notes text,

  -- Fase 1
  fase1_daily_respecteert_zone boolean,
  fase1_spelers_verleden boolean,
  -- Fase 2
  fase2_daily_respecteert_zone boolean,
  fase2_structuur structuur_enum,
  -- Fase 3
  fase3_zone_min_2_touches boolean,
  fase3_engulfing_candle boolean,
  fase3_beide boolean generated always as (
    coalesce(fase3_zone_min_2_touches,false) and coalesce(fase3_engulfing_candle,false)
  ) stored,
  fase3_structuur structuur_enum,
  -- Fase 4
  fase4_weekly_bevestigingscandle boolean,

  weekly_review_id uuid references weekly_reviews(id) on delete set null,
  backtest_project_id uuid references backtest_projects(id) on delete cascade,

  -- Broker-import dedup reference "{broker}:{ticket}" (NULL for hand-entered
  -- trades). Makes re-importing the same export idempotent. See 0017_trade_import_ref.sql.
  import_ref text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ACCOUNTS ----------
create table prop_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  naam text not null,
  account_size numeric(12,2) not null,
  fase prop_fase_enum not null default 'Phase 1',
  actief boolean not null default true,
  current_pnl_pct numeric(6,2),
  -- Prop-firm rules (% of account size, nullable = not configured, manually entered).
  -- See migration 0013_prop_firm_rules.sql.
  profit_target_pct numeric(6,2) check (profit_target_pct > 0),
  max_drawdown_pct numeric(6,2) check (max_drawdown_pct > 0),
  daily_loss_limit_pct numeric(6,2) check (daily_loss_limit_pct > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references prop_accounts(id) on delete cascade,
  bedrag numeric(12,2) not null,
  datum date not null,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- CUSTOM OPTIONS ----------
-- Per-user extra values for a fixed-list form field (e.g. field='entry'), merged
-- client-side on top of the shared constant list — see useCustomOptions.
create table custom_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  field text not null,
  value text not null,
  created_at timestamptz not null default now(),
  unique (user_id, field, value)
);

-- ---------- INDEXES ----------
create index idx_trades_user on trades(user_id);
create index idx_trades_datum_open on trades(datum_open);
create index idx_trades_fase on trades(fase);
create index idx_trades_pair on trades(pair);
create index idx_trades_weekly_review on trades(weekly_review_id);
create index idx_trades_backtest_project on trades(backtest_project_id);
create unique index trades_user_import_ref_unique on trades(user_id, import_ref) where import_ref is not null;
create index idx_payouts_account on payouts(account_id);
create index idx_periodic_reviews_user on periodic_reviews(user_id);

-- ---------- updated_at TRIGGERS ----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_trades_updated_at before update on trades
  for each row execute function set_updated_at();
create trigger trg_weekly_reviews_updated_at before update on weekly_reviews
  for each row execute function set_updated_at();
create trigger trg_prop_accounts_updated_at before update on prop_accounts
  for each row execute function set_updated_at();
create trigger trg_backtest_projects_updated_at before update on backtest_projects
  for each row execute function set_updated_at();
create trigger trg_periodic_reviews_updated_at before update on periodic_reviews
  for each row execute function set_updated_at();
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ---------- timezone-aware trading session mapping (see 0019) ----------
-- (cc, date, tz) -> session, anchored to the reference zone the methodology was
-- authored in (Europe/Brussels). STABLE (depends on the tz database), so it can't
-- live in a generated column — a trigger maintains trades.sessie instead.
create or replace function compute_sessie(p_cc cc_enum, p_datum date, p_tz text)
returns sessie_enum
language plpgsql
stable
as $$
declare
  brussels_hour int;
begin
  if p_cc is null or p_datum is null then
    return null;
  end if;

  brussels_hour := extract(
    hour from
      ((p_datum::timestamp + make_interval(hours => p_cc::text::int))
        at time zone coalesce(p_tz, 'Europe/Brussels'))
        at time zone 'Europe/Brussels'
  )::int;

  return case
    when brussels_hour between 0 and 7  then 'Asia'::sessie_enum
    when brussels_hour between 8 and 15 then 'London'::sessie_enum
    when brussels_hour between 16 and 19 then 'Overlap'::sessie_enum
    else 'New York'::sessie_enum
  end;
end;
$$;

create or replace function trades_set_sessie() returns trigger
language plpgsql as $$
declare
  v_tz text;
begin
  select timezone into v_tz from profiles where id = new.user_id;
  new.sessie := compute_sessie(new.cc, new.datum_open, coalesce(v_tz, 'Europe/Brussels'));
  return new;
end;
$$;

create trigger trg_trades_set_sessie
  before insert or update of cc, datum_open on trades
  for each row execute function trades_set_sessie();

-- Re-bucket a user's trades when they change their timezone.
create or replace function profiles_recompute_sessie() returns trigger
language plpgsql as $$
begin
  if new.timezone is distinct from old.timezone then
    update trades set sessie = compute_sessie(cc, datum_open, new.timezone)
    where user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_recompute_sessie
  after update of timezone on profiles
  for each row execute function profiles_recompute_sessie();

-- ---------- auto-provision profiles row on new auth.users signup ----------
-- SECURITY DEFINER: the client's JWT has no insert rights on auth.users or a
-- brand-new profiles row at signup time, so this runs with elevated
-- privileges, scoped tightly to just this insert.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- self-service account deletion (GDPR right to erasure) ----------
-- SECURITY DEFINER: the client's JWT has no delete rights on auth.users. This
-- only ever deletes the caller's own row (auth.uid(), never a parameter) —
-- every other table cascades away via its `on delete cascade` FK to
-- auth.users(id), so nothing else needs to be touched here.
create or replace function delete_own_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function delete_own_account() from public;
grant execute on function delete_own_account() to authenticated;

-- ---------- admin read-only access (debugging, future coaching foundation) ----------
-- SECURITY DEFINER for the same reason as delete_own_account() above: the
-- calling client can't safely read another admin-check row without RLS
-- recursion, so this runs with elevated privileges scoped to a single
-- boolean read. Used only to grant additional SELECT-only RLS policies
-- below — never write access.
create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

revoke all on function is_admin() from public;
grant execute on function is_admin() to authenticated;

-- ---------- per-project trade summaries (Fase 2, server-side aggregation) ----------
-- One aggregated row per backtest project instead of shipping every project
-- trade to the client for the projects-list summary cards. Mirrors
-- computeOutcomeCounts() in src/lib/stats/core.ts; excludes missed trades to
-- honour the shared missed-trade contract server-side. SECURITY INVOKER (default)
-- so RLS applies; the explicit user_id filter also blocks the admin read-all
-- policy from summing other users' projects. See 0016_project_trade_summaries.sql.
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

revoke all on function get_project_trade_summaries() from public;
grant execute on function get_project_trade_summaries() to authenticated;

-- ---------- auto-link trade <-> weekly_review ----------
-- Two BEFORE/AFTER INSERT triggers keep the link in sync in both directions:
--   * new trade  -> find existing review for its ISO week (below)
--   * new review -> backfill existing live trades of that week (further down)
-- (edited a trade's date into another week? the link is only refreshed by the
--  manual relink action in-app — see linkTradesToReview in useWeeklyReviews.ts)
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

create trigger trg_link_trade_weekly_review
  before insert on trades
  for each row execute function link_trade_to_weekly_review();

-- reverse direction: a review created after its week's trades already exist
-- backfills those live trades, so it isn't limited to the insert-time link above.
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

-- ---------- RLS ----------
alter table trades enable row level security;
alter table weekly_reviews enable row level security;
alter table prop_accounts enable row level security;
alter table payouts enable row level security;
alter table backtest_projects enable row level security;
alter table periodic_reviews enable row level security;
alter table profiles enable row level security;
alter table custom_options enable row level security;

-- No insert/delete policy for profiles: rows are created only by the
-- handle_new_user() trigger above and removed via the auth.users FK cascade.
create policy "profiles_owner_select" on profiles
  for select using (id = auth.uid());
create policy "profiles_owner_update" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "custom_options_owner_all" on custom_options
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "trades_owner_all" on trades
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weekly_reviews_owner_all" on weekly_reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "periodic_reviews_owner_all" on periodic_reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "backtest_projects_owner_all" on backtest_projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "prop_accounts_owner_all" on prop_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "payouts_owner_all" on payouts
  for all using (exists (select 1 from prop_accounts pa where pa.id = payouts.account_id and pa.user_id = auth.uid()))
  with check (exists (select 1 from prop_accounts pa where pa.id = payouts.account_id and pa.user_id = auth.uid()));

-- Admin read-only carve-out: additive permissive SELECT policies (Postgres
-- ORs multiple permissive policies together), so every owner policy above
-- is untouched — admins simply gain read access on top.
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
