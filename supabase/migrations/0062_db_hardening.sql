-- 0062 — DB-hardening (deep review 2026-09-17, blok C). Idempotent.
--
-- C1  Journal-delete-FK's van ON DELETE SET NULL → ON DELETE NO ACTION op
--     trades / weekly_reviews / periodic_reviews / prop_accounts
--     (.methodology_id). De client verwijdert alleen aantoonbaar lege journals
--     (useJournals.deleteJournal hercheckt server-side), maar SET NULL liet een
--     raced delete of een directe PostgREST-call trades stil loskoppelen — het
--     TOCTOU-gat. ⚠️ Bewust NO ACTION en niet RESTRICT (afwijking van het
--     reviewrapport): RESTRICT wordt per rij onmiddellijk gecheckt en zou
--     delete_own_account() (cascade vanuit auth.users naar én trades én
--     methodologies, volgorde ongedefinieerd) nondeterministisch kunnen breken;
--     NO ACTION checkt aan het einde van het statement — beide cascades zijn
--     dan klaar — en blokkeert een losse journal-delete-met-data even hard.
--     share_links.methodology_id blijft CASCADE (een link zonder journal is
--     betekenisloos); profiles.methodology_id blijft SET NULL (de actieve-
--     journal-pointer mag leegvallen, de app vangt dat).
-- C2  trade_contracts droppen — de feature is 2026-09-15 uit de app verwijderd;
--     policies + indexes + FK gaan met de tabel mee.
-- C3  CHECK trades_dates_chk (datum_sluiting >= datum_open): NOT VALID eerst,
--     daarna een validate-poging die bij bestaande foute rijen alleen een
--     warning geeft i.p.v. de hele migratie te blokkeren.
-- C4  Redundante/dode indexes weg: idx_habit_days_user_day en
--     idx_daily_journal_entries_user_date (dubbel t.o.v. de unique-indexes op
--     dezelfde kolommen), idx_trades_pair en idx_trades_datum_open (geen
--     serverpad gebruikt ze; het hoofdleespad heeft idx_trades_user_methodology_datum),
--     idx_trades_fase (al weg met de kolom-drop in 0059 — vangnet).
-- C5  Ownership-trigger óók op backtest_project_id + weekly_review_id: die
--     FK's checken alleen dat de rij bestaat, niet van wíé hij is — een write
--     kon een trade aan andermans project/review hangen (RLS-bypass op de
--     koppeling). Zelfde recept als de methodology-check uit 0044.

-- ---------- C1: NO ACTION-FK's (was SET NULL) ----------
alter table trades drop constraint if exists trades_methodology_id_fkey;
alter table trades add constraint trades_methodology_id_fkey
  foreign key (methodology_id) references methodologies(id) on delete no action;

alter table weekly_reviews drop constraint if exists weekly_reviews_methodology_id_fkey;
alter table weekly_reviews add constraint weekly_reviews_methodology_id_fkey
  foreign key (methodology_id) references methodologies(id) on delete no action;

alter table periodic_reviews drop constraint if exists periodic_reviews_methodology_id_fkey;
alter table periodic_reviews add constraint periodic_reviews_methodology_id_fkey
  foreign key (methodology_id) references methodologies(id) on delete no action;

alter table prop_accounts drop constraint if exists prop_accounts_methodology_id_fkey;
alter table prop_accounts add constraint prop_accounts_methodology_id_fkey
  foreign key (methodology_id) references methodologies(id) on delete no action;

-- ---------- C2: trade_contracts weg ----------
drop table if exists trade_contracts;

-- ---------- C3: datums-check ----------
alter table trades drop constraint if exists trades_dates_chk;
alter table trades add constraint trades_dates_chk
  check (datum_sluiting is null or datum_sluiting >= datum_open) not valid;
do $$
begin
  begin
    alter table trades validate constraint trades_dates_chk;
  exception when check_violation then
    raise warning 'trades_dates_chk blijft NOT VALID: er bestaan rijen met datum_sluiting < datum_open. '
      'Fix ze (select id, datum_open, datum_sluiting from trades where datum_sluiting < datum_open) '
      'en draai daarna: alter table trades validate constraint trades_dates_chk;';
  end;
end $$;

-- ---------- C4: dode indexes ----------
drop index if exists idx_habit_days_user_day;
drop index if exists idx_daily_journal_entries_user_date;
drop index if exists idx_trades_fase;
drop index if exists idx_trades_pair;
drop index if exists idx_trades_datum_open;

-- ---------- C5: ownership-trigger verbreed ----------
-- ⚠️ CREATE OR REPLACE: schema.sql draagt exact dezelfde definitie (de
-- 0043-regressieklasse). Invoker rights volstaan: de eigen RLS-policies op
-- methodologies/backtest_projects/weekly_reviews laten precies de eigen rijen
-- zien, en dat is wat de exists-checks nodig hebben.
create or replace function enforce_trades_journal_ownership() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.methodology_id is not null and not exists (
    select 1 from methodologies m
    where m.id = new.methodology_id
      and m.user_id = new.user_id
      and not m.is_system
  ) then
    raise exception 'trades.methodology_id must reference one of the trade owner''s own journals (not a system template)'
      using errcode = 'check_violation';
  end if;
  if new.backtest_project_id is not null and not exists (
    select 1 from backtest_projects p
    where p.id = new.backtest_project_id
      and p.user_id = new.user_id
  ) then
    raise exception 'trades.backtest_project_id must reference one of the trade owner''s own projects'
      using errcode = 'check_violation';
  end if;
  if new.weekly_review_id is not null and not exists (
    select 1 from weekly_reviews w
    where w.id = new.weekly_review_id
      and w.user_id = new.user_id
  ) then
    raise exception 'trades.weekly_review_id must reference one of the trade owner''s own weekly reviews'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trades_journal_ownership on trades;
create trigger trg_trades_journal_ownership
  before insert or update of methodology_id, backtest_project_id, weekly_review_id, user_id on trades
  for each row execute function enforce_trades_journal_ownership();

-- Registratie (runner doet dit ook; on conflict dekt de SQL-editor-route, 0057-conventie).
insert into schema_migrations (filename) values ('0062_db_hardening.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- C1 (verwacht: 4 rijen, allemaal confdeltype 'a' = NO ACTION; 'n' = het oude SET NULL):
--   select conname, confdeltype from pg_constraint
--   where conname in ('trades_methodology_id_fkey','weekly_reviews_methodology_id_fkey',
--                     'periodic_reviews_methodology_id_fkey','prop_accounts_methodology_id_fkey');
--   -- C2 (verwacht: 0 rijen):
--   select 1 from information_schema.tables where table_name = 'trade_contracts';
--   -- C3 (verwacht: convalidated = true; anders staan er foute rijen):
--   select conname, convalidated from pg_constraint where conname = 'trades_dates_chk';
--   -- C4 (verwacht: 0 rijen):
--   select indexname from pg_indexes where indexname in
--     ('idx_habit_days_user_day','idx_daily_journal_entries_user_date',
--      'idx_trades_fase','idx_trades_pair','idx_trades_datum_open');
--   -- C5 (verwacht: de functietekst bevat backtest_project_id én weekly_review_id):
--   select pg_get_functiondef('enforce_trades_journal_ownership()'::regprocedure);
-- =========================================================
