-- Timezone-aware trading sessions (Fase 3 — internationaal).
--
-- Until now `trades.sessie` was a STORED generated column that mapped `cc`
-- (4H candle close slot) straight to a session via a fixed CASE. That silently
-- assumed every user reads candle closes in the same wall clock. The methodology
-- was authored in Brussels local time, so the fixed map is only correct for a
-- Europe/Brussels user; anyone in another timezone gets the wrong session.
--
-- A generated column can't do this correctly: interpreting a local time in a
-- timezone (AT TIME ZONE) is STABLE, not IMMUTABLE, so Postgres rejects it inside
-- `generated always as (...)`. So session moves to a BEFORE trigger that reads the
-- owning user's timezone. Read paths (filters, breakdowns, admin, RPC) are
-- unchanged — `sessie` is still a plain stored `sessie_enum` column.
--
-- Session is defined relative to the reference zone the methodology was authored
-- in (Europe/Brussels): the trade's cc-hour on datum_open is interpreted in the
-- user's timezone, converted to Brussels wall time, then bucketed. For a Brussels
-- user this reproduces the old fixed map exactly (03/07→Asia, 11/15→London,
-- 19→Overlap, 23→New York), so existing data is unchanged.

-- 1. Per-user timezone (IANA name). Default = the methodology's reference zone.
alter table profiles add column if not exists timezone text not null default 'Europe/Brussels';

-- 2. Pure-ish mapping: (cc, date, tz) -> session. STABLE (depends on the tz
--    database), which is why it lives here and not in a generated column.
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

  -- Build the naive local candle-close timestamp, read it as the user's local
  -- time, then express that same instant as Brussels wall time.
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

-- 3. Replace the generated `sessie` column with a plain trigger-maintained one.
alter table trades drop column sessie;
alter table trades add column sessie sessie_enum;

-- 4. Keep `sessie` in sync on every write. `of cc, datum_open` scopes UPDATEs to
--    the columns that change the result; INSERT always fires.
create or replace function trades_set_sessie()
returns trigger
language plpgsql
as $$
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

-- 5. Changing a user's timezone re-buckets all their trades.
create or replace function profiles_recompute_sessie()
returns trigger
language plpgsql
as $$
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

-- 6. Backfill existing rows (identity for Europe/Brussels users).
update trades t
set sessie = compute_sessie(t.cc, t.datum_open, coalesce(p.timezone, 'Europe/Brussels'))
from profiles p
where p.id = t.user_id;

-- 7. Restore the not-null invariant the generated column used to guarantee.
alter table trades alter column sessie set not null;
