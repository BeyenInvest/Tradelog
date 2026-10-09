-- =========================================================
-- Beyen Invest — migration: broker-koppeling (cTrader Open API)
--
-- Een gebruiker koppelt via OAuth zijn cTrader-ID; gesloten posities komen
-- daarna automatisch in het gekozen journal (plan: docs/plan-ctrader-sync.md).
--
-- Twee tabellen, bewust gescheiden op gevoeligheid:
--   broker_connections — één rij per OAuth-grant, draagt de (AES-GCM-versleutelde)
--     access/refresh-tokens. GEEN grants voor anon/authenticated: alleen de
--     server (api/ctrader*.ts, service role) leest/schrijft deze tabel.
--   broker_accounts — één rij per trading-account onder een grant. Leesbaar voor
--     de eigenaar; alleen de koppel-instellingen (journal, aan/uit, sync-cursor)
--     zijn door de eigenaar bij te werken (kolom-grants). Aanmaken/verwijderen
--     loopt via de server.
--
-- Idempotent — safe to re-run.
-- =========================================================

create table if not exists broker_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('ctrader')),
  access_token_enc text not null,
  refresh_token_enc text not null,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_broker_connections_user on broker_connections(user_id);

alter table broker_connections enable row level security;
-- Geen policies + geen grants: de tokens verlaten de server nooit.
revoke all on broker_connections from anon, authenticated;

drop trigger if exists trg_broker_connections_updated_at on broker_connections;
create trigger trg_broker_connections_updated_at before update on broker_connections
  for each row execute function set_updated_at();

create table if not exists broker_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references broker_connections(id) on delete cascade,
  provider text not null check (provider in ('ctrader')),
  -- cTrader ctidTraderAccountId (de API-sleutel van het account).
  external_account_id bigint not null,
  is_live boolean not null,
  account_login text,
  broker_name text,
  -- Doel-journal. Null = nog niet gekozen → er wordt niets gesynct.
  methodology_id uuid references methodologies(id) on delete set null,
  enabled boolean not null default false,
  -- Sync-cursor: deals vóór dit moment zijn al verwerkt. De eerste sync haalt
  -- de laatste 30 dagen op (de gebruiker kan dit in Settings vervroegen).
  synced_until timestamptz not null default (now() - interval '30 days'),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists broker_accounts_user_provider_ext_unique
  on broker_accounts(user_id, provider, external_account_id);
create index if not exists idx_broker_accounts_connection on broker_accounts(connection_id);
create index if not exists idx_broker_accounts_methodology on broker_accounts(methodology_id);

alter table broker_accounts enable row level security;

drop policy if exists "broker_accounts_owner_select" on broker_accounts;
create policy "broker_accounts_owner_select" on broker_accounts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "broker_accounts_owner_update" on broker_accounts;
create policy "broker_accounts_owner_update" on broker_accounts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on broker_accounts from anon, authenticated;
grant select on broker_accounts to authenticated;
grant update (methodology_id, enabled, synced_until, last_synced_at) on broker_accounts to authenticated;

-- Doel-journal moet een eigen (niet-systeem) journal zijn — zelfde regel als
-- enforce_trades_journal_ownership (0062), anders zou een sync in andermans
-- journal proberen te schrijven (de trades-trigger zou dat alsnog weigeren,
-- maar dan pas bij de insert).
create or replace function enforce_broker_accounts_journal_ownership() returns trigger
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
    raise exception 'broker_accounts.methodology_id must reference one of the owner''s own journals'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_broker_accounts_journal_ownership on broker_accounts;
create trigger trg_broker_accounts_journal_ownership
  before insert or update of methodology_id, user_id on broker_accounts
  for each row execute function enforce_broker_accounts_journal_ownership();

drop trigger if exists trg_broker_accounts_updated_at on broker_accounts;
create trigger trg_broker_accounts_updated_at before update on broker_accounts
  for each row execute function set_updated_at();

-- Admin read-only carve-out (0046-patroon) — alleen de account-metadata, nooit de tokens.
drop policy if exists "broker_accounts_admin_select" on broker_accounts;
create policy "broker_accounts_admin_select" on broker_accounts
  for select to authenticated using (is_admin());

insert into schema_migrations (filename) values ('0065_broker_connections.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- verwacht: 2 rijen, rowsecurity = true
--   select tablename, rowsecurity from pg_tables where tablename in ('broker_connections','broker_accounts');
--   -- verwacht: false / false (tokens onbereikbaar voor clients)
--   select has_table_privilege('authenticated','broker_connections','select'),
--          has_table_privilege('anon','broker_connections','select');
--   -- verwacht: true / false
--   select has_column_privilege('authenticated','broker_accounts','enabled','update'),
--          has_column_privilege('authenticated','broker_accounts','connection_id','update');
-- =========================================================
