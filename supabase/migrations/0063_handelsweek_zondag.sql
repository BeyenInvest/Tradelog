-- 0063 — Handelsweek: zondag ≥ 22:00 hoort bij de volgende week
-- (owner-besluit 2026-09-30, docs/plan-handelsweek-zondag.md). Idempotent.
--
-- Regel: een trade met datum_open op een zondag én tijd_open >= 22:00 hoort
-- bij de ISO-week van de maandag erna (Asia-/futures-open). tijd_open is
-- naïef-lokaal (0051), dus geen tijdzone-conversie; een zondag-trade ZONDER
-- tijd_open blijft bewust in de oude week. De TS-kant van dezelfde regel is
-- tradingDateOf()/SUNDAY_ROLLOVER in src/lib/isoWeek.ts — in sync houden.
--
-- 1) trading_date_of(): immutable helper — dé SQL-bron van de regel.
-- 2) link_trade_to_weekly_review: week via de helper; trigger vuurt nu óók op
--    tijd_open en de "echt gewijzigd"-check vergelijkt tijd_open mee.
-- 3) link_weekly_review_to_trades: idem via de helper.
-- 4) relink_weekly_review(p_review_id): RPC (security invoker, RLS geldt) die
--    de twee PostgREST-datumrange-updates van de client vervangt — de
--    handelsweek is geen datumrange meer, en zo delen client-relink en
--    triggers exact dezelfde weekberekening.
-- 5) Backfill: elke live zondag-≥22:00-trade krijgt zijn weekly_review_id
--    opnieuw bepaald (review van de handelsweek in hetzelfde journal, anders
--    null), met vóór/na-telling in de notices.

-- ---------- 1: de helper ----------
create or replace function trading_date_of(d date, t time) returns date
language sql
immutable
set search_path = public
as $$
  -- t is null => case is null => else-tak: zondag zonder tijd blijft de oude week.
  select case when extract(isodow from d) = 7 and t >= time '22:00' then d + 1 else d end;
$$;

revoke all on function trading_date_of(date, time) from public, anon;
grant execute on function trading_date_of(date, time) to authenticated;

-- ---------- 2: trade -> review (before insert/update) ----------
-- ⚠️ CREATE OR REPLACE: schema.sql draagt exact dezelfde definitie (0043-les).
create or replace function link_trade_to_weekly_review() returns trigger as $$
declare
  iso_year int;
  iso_week int;
  found_id uuid;
begin
  -- backtest_project_id is not null => project trade, never belongs to a weekly review
  if new.backtest_project_id is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Ongewijzigd 0030-gedrag: een expliciet meegegeven koppeling respecteren.
    if new.weekly_review_id is not null then
      return new;
    end if;
  else
    -- UPDATE: alleen her-resolven als de week-bepalende velden écht wijzigen —
    -- de kolomlijst van de trigger vuurt al bij het NOEMEN van de kolom in SET
    -- (het volle trade-formulier stuurt altijd alles mee), dus vergelijk zelf.
    -- tijd_open telt sinds 0063 mee: 23:00 -> 20:00 op een zondag = andere week.
    if new.datum_open is not distinct from old.datum_open
       and new.tijd_open is not distinct from old.tijd_open
       and new.methodology_id is not distinct from old.methodology_id then
      return new;
    end if;
  end if;
  iso_year := extract(isoyear from trading_date_of(new.datum_open, new.tijd_open));
  iso_week := extract(week from trading_date_of(new.datum_open, new.tijd_open));
  select id into found_id from weekly_reviews
    where user_id = new.user_id
      and methodology_id is not distinct from new.methodology_id
      and jaar = iso_year and week_nummer = iso_week
    limit 1;
  new.weekly_review_id := found_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_link_trade_weekly_review on trades;
create trigger trg_link_trade_weekly_review
  before insert or update of datum_open, tijd_open, methodology_id on trades
  for each row execute function link_trade_to_weekly_review();

-- ---------- 3: review -> trades (after insert) ----------
create or replace function link_weekly_review_to_trades() returns trigger as $$
begin
  update trades
    set weekly_review_id = new.id
    where user_id = new.user_id
      and backtest_project_id is null
      and methodology_id is not distinct from new.methodology_id
      and weekly_review_id is null
      and extract(isoyear from trading_date_of(datum_open, tijd_open)) = new.jaar
      and extract(week from trading_date_of(datum_open, tijd_open)) = new.week_nummer;
  return new;
end;
$$ language plpgsql;

-- ---------- 4: de relink-RPC ----------
-- SECURITY INVOKER (default): de select ziet alleen eigen reviews en de
-- updates lopen door de eigen trades-RLS — precies wat de client-relink deed.
-- Leest jaar/week/journal uit de review-rij zelf, dus ná een week-edit eerst
-- de review updaten en dan deze RPC aanroepen. Retourneert het aantal
-- gekoppelde trades (zelfde telling als de oude client-versie: alle matches,
-- ook al gekoppelde).
create or replace function relink_weekly_review(p_review_id uuid) returns integer
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_linked integer;
begin
  select id, user_id, methodology_id, jaar, week_nummer into r
    from weekly_reviews where id = p_review_id;
  if not found then
    return 0; -- bestaat niet of niet van de aanroeper (RLS)
  end if;
  -- Ontkoppelen wat niet meer in de handelsweek valt (bv. trade-datum gewijzigd).
  update trades
    set weekly_review_id = null
    where weekly_review_id = r.id
      and (extract(isoyear from trading_date_of(datum_open, tijd_open)) is distinct from r.jaar
        or extract(week from trading_date_of(datum_open, tijd_open)) is distinct from r.week_nummer);
  -- Koppelen: live trades van hetzelfde journal in de handelsweek — nooit een
  -- ander journal of een backtest-project de review in trekken (cyclus 3b).
  update trades
    set weekly_review_id = r.id
    where user_id = r.user_id
      and backtest_project_id is null
      and methodology_id is not distinct from r.methodology_id
      and extract(isoyear from trading_date_of(datum_open, tijd_open)) = r.jaar
      and extract(week from trading_date_of(datum_open, tijd_open)) = r.week_nummer;
  get diagnostics v_linked = row_count;
  return v_linked;
end;
$$;

revoke all on function relink_weekly_review(uuid) from public, anon;
grant execute on function relink_weekly_review(uuid) to authenticated;

-- ---------- 5: backfill ----------
-- Alleen de rollover-rijen zelf (live, zondag, >= 22:00) worden aangeraakt;
-- de SET raakt uitsluitend weekly_review_id, dus de link-trigger (kolomlijst
-- datum_open/tijd_open/methodology_id) vuurt niet en de ownership-trigger
-- keurt de eigen review van dezelfde user goed.
do $$
declare
  v_candidates integer;
  v_changed integer;
begin
  select count(*) into v_candidates from trades
    where backtest_project_id is null
      and extract(isodow from datum_open) = 7
      and tijd_open >= time '22:00';
  raise notice 'handelsweek-backfill vóór: % kandidaat-trades (live, zondag >= 22:00)', v_candidates;

  update trades t
    set weekly_review_id = (
      select w.id from weekly_reviews w
      where w.user_id = t.user_id
        and w.methodology_id is not distinct from t.methodology_id
        and w.jaar = extract(isoyear from trading_date_of(t.datum_open, t.tijd_open))
        and w.week_nummer = extract(week from trading_date_of(t.datum_open, t.tijd_open))
      limit 1
    )
    where t.backtest_project_id is null
      and extract(isodow from t.datum_open) = 7
      and t.tijd_open >= time '22:00';
  get diagnostics v_changed = row_count;
  raise notice 'handelsweek-backfill na: % rijen herbepaald (review van de volgende week, anders null)', v_changed;
end $$;

-- Registratie (runner doet dit ook; on conflict dekt de SQL-editor-route, 0057-conventie).
insert into schema_migrations (filename) values ('0063_handelsweek_zondag.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- Helper (verwacht: 2026-10-05, 2026-10-04, 2026-10-04, 2026-10-05 — de
--   -- laatste is de jaar-/maandgrens-analoog: zondag + 1 dag):
--   select trading_date_of(date '2026-10-04', time '22:00'),
--          trading_date_of(date '2026-10-04', time '21:59'),
--          trading_date_of(date '2026-10-04', null),
--          trading_date_of(date '2026-10-04', time '23:30');
--   -- Jaarwissel (verwacht: isoyear 2026, week 1 — zondag 27-12-2025 22:00 hoort bij week 1 van 2026):
--   select extract(isoyear from trading_date_of(date '2025-12-28', time '22:00')) as jr,
--          extract(week    from trading_date_of(date '2025-12-28', time '22:00')) as wk;
--   -- Trigger vuurt op tijd_open (verwacht: tijd_open in de kolomlijst):
--   select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_link_trade_weekly_review';
--   -- Beide functies gebruiken de helper (verwacht: 2 rijen met 'trading_date_of' in de body):
--   select proname from pg_proc
--   where proname in ('link_trade_to_weekly_review','link_weekly_review_to_trades')
--     and prosrc like '%trading_date_of%';
--   -- RPC bestaat + grants (verwacht: 1 rij, invoker, alleen authenticated):
--   select proname, prosecdef from pg_proc where proname = 'relink_weekly_review';
--   -- Backfill-steekproef (verwacht: 0 rijen — geen rollover-trade linkt nog naar de week van z'n zondag):
--   select t.id from trades t join weekly_reviews w on w.id = t.weekly_review_id
--   where t.backtest_project_id is null
--     and extract(isodow from t.datum_open) = 7 and t.tijd_open >= time '22:00'
--     and (w.jaar, w.week_nummer) = (extract(isoyear from t.datum_open), extract(week from t.datum_open))
--     and (w.jaar, w.week_nummer) is distinct from
--         (extract(isoyear from trading_date_of(t.datum_open, t.tijd_open)),
--          extract(week    from trading_date_of(t.datum_open, t.tijd_open)));
-- =========================================================
