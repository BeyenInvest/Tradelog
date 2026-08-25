-- =========================================================
-- Beyen Invest — migration 0051: trades.tijd_open (Fase S2, sessie/uur-dimensie)
--
-- Adds the real open *time* next to datum_open, so session- and hour-breakdowns
-- can run on the actual time axis instead of the legacy 4H candle-close slot.
--
--   tijd_open   time, nullable — the wall-clock open time in the OWNER'S OWN
--               timezone (profiles.timezone), exactly as typed. Deliberately not
--               timestamptz: the whole app treats datum_open as a local date and
--               cc as a local hour, interpreted tz-aware in the DB (0019). A
--               naive local time keeps what the trader typed stable when they
--               later change profiles.timezone — only the *session bucketing*
--               shifts, same as cc always behaved.
--
-- Why not convert datum_open date -> timestamp: duur_dagen is a generated
-- column on date arithmetic, the weekly-review triggers extract isoyear/week
-- from it, and every frontend read path compares "yyyy-mm-dd" strings. A
-- nullable time column is the backward-compatible equivalent: null = time
-- unknown (all existing rows, quick-log, imports) -> the trade simply doesn't
-- take part in time-based breakdowns. No backfill needed or possible.
--
-- Session derivation: when tijd_open is present it WINS over the cc slot — the
-- actual entry time is strictly more accurate than the 4H candle-close bucket.
-- Without it, the cc path from 0019 is unchanged, so existing rows keep their
-- sessie byte-for-byte. This also makes `sessie` meaningful for the first time
-- on universal (non-WPM) journals, where cc sits on its hidden default "11"
-- and sessie was therefore a constant "London".
--
-- Idempotent / re-runnable: add-column-if-not-exists, create-or-replace
-- functions, drop-then-create trigger (its column list changes).
--
-- Run: via de Supabase SQL Editor (of node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0051_tijd_open.sql)
-- =========================================================

alter table trades add column if not exists tijd_open time;

-- Time-based sibling of compute_sessie (0019): interpret the local open
-- timestamp in the user's timezone, express that instant as Brussels wall time
-- (the reference zone the session buckets were authored in), then bucket.
-- STABLE, not IMMUTABLE — depends on the tz database, so no generated column.
create or replace function compute_sessie_at(p_datum date, p_tijd time, p_tz text)
returns sessie_enum
language plpgsql
stable
as $$
declare
  brussels_hour int;
begin
  if p_datum is null or p_tijd is null then
    return null;
  end if;

  brussels_hour := extract(
    hour from
      ((p_datum + p_tijd)
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

-- Keep `sessie` in sync on every write: real time wins, cc slot is the
-- fallback (identical to pre-0051 behaviour when tijd_open is null).
create or replace function trades_set_sessie()
returns trigger
language plpgsql
as $$
declare
  v_tz text;
begin
  select timezone into v_tz from profiles where id = new.user_id;
  if new.tijd_open is not null then
    new.sessie := compute_sessie_at(new.datum_open, new.tijd_open, coalesce(v_tz, 'Europe/Brussels'));
  else
    new.sessie := compute_sessie(new.cc, new.datum_open, coalesce(v_tz, 'Europe/Brussels'));
  end if;
  return new;
end;
$$;

-- The trigger's column list grows with tijd_open, so drop-then-create.
drop trigger if exists trg_trades_set_sessie on trades;
create trigger trg_trades_set_sessie
  before insert or update of cc, datum_open, tijd_open on trades
  for each row execute function trades_set_sessie();

-- Changing a user's timezone re-buckets all their trades — now time-aware.
create or replace function profiles_recompute_sessie()
returns trigger
language plpgsql
as $$
begin
  if new.timezone is distinct from old.timezone then
    update trades set sessie = case
      when tijd_open is not null then compute_sessie_at(datum_open, tijd_open, new.timezone)
      else compute_sessie(cc, datum_open, new.timezone)
    end
    where user_id = new.id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   select column_name, data_type, is_nullable from information_schema.columns
--     where table_name = 'trades' and column_name = 'tijd_open';
--   -- kolom aanwezig, time without time zone, nullable; bestaande rijen null:
--   select count(*) filter (where tijd_open is not null) as met_tijd, count(*) as totaal from trades;
--   -- trigger vernieuwd (definitie bevat "cc, datum_open, tijd_open"):
--   select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_trades_set_sessie';
--   -- functie aanwezig:
--   select proname from pg_proc where proname = 'compute_sessie_at';
--   -- steekproef bucketing (Brussel, 14:30 lokale tijd -> London):
--   select compute_sessie_at('2026-08-25'::date, '14:30'::time, 'Europe/Brussels');
-- =========================================================
