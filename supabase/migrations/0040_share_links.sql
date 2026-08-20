-- =========================================================
-- Beyen Invest — migration 0040: share-links (Fase M — coaching & sharing)
--
-- Een owner kan een coach een token-URL sturen die het journal read-only
-- toont zónder account. Ontwerp (docs/fase-M-N-handoff.md):
--   * `share_links`: token = capability (wie de link heeft, ziet het journal).
--     Owner beheert eigen rijen via RLS; anon heeft GEEN toegang tot de tabel.
--   * Anon leest uitsluitend via de SECURITY DEFINER RPC get_shared_journal(token),
--     die het token valideert (bestaat, niet ingetrokken, niet verlopen) en
--     alleen de live-journal-trades van precies dat user_id+methodology_id
--     teruggeeft — bewust géén RLS-policy op `trades` voor anon (kleinste
--     oppervlak).
--   * scope: nu alleen 'journal'. Review-sharing is een latere slice — die
--     versoepelt de CHECK en voegt een review-verwijzing toe; kolommen daarvoor
--     nu al raden (welke review-tabel? FK?) zou dode ballast zijn.
--
-- token: 2× gen_random_uuid() zonder streepjes = 64 hex-tekens (~244 bits
-- entropie), URL-veilig, core-Postgres (geen pgcrypto-schema-gedoe).
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0040_share_links.sql
-- =========================================================

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Welk journal gedeeld wordt. null = het legacy/ongescopete journal
  -- (trades.methodology_id is null), zelfde semantiek als useTrades.
  methodology_id uuid references methodologies(id) on delete cascade,
  scope text not null default 'journal' check (scope in ('journal')),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  -- null = verloopt nooit; de app zet standaard een vervaldatum (30 dagen).
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- FK-index-conventie van dit project (vgl. idx_trades_methodology e.d. in
-- schema.sql): dekt de owner-lijstquery (RLS user_id + journal-filter) én de
-- cascade-check bij het verwijderen van een journal.
create index if not exists idx_share_links_user_methodology on share_links(user_id, methodology_id);

alter table share_links enable row level security;

-- Owner beheert eigen links. De with-check eist óók dat het gedeelde journal
-- van de inserter zelf is — de kale FK wordt als table-owner gecheckt (bypasst
-- methodologies-RLS), dus zonder deze subquery zou een geldige vreemde
-- methodology-uuid geaccepteerd worden en via de RPC andermans journalnaam
-- prijsgeven. Anon matcht auth.uid() nooit → geen rijen; de expliciete revoke
-- hieronder haalt óók het tabel-privilege weg (hygiëne — Supabase default
-- privileges geven elke nieuwe tabel rechten aan anon).
drop policy if exists "share_links_owner_all" on share_links;
create policy "share_links_owner_all" on share_links
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      methodology_id is null
      or exists (
        select 1 from methodologies m
        where m.id = methodology_id and m.user_id = auth.uid()
      )
    )
  );

revoke all on table share_links from anon;

-- ---------------------------------------------------------
-- get_shared_journal(token): het enige leespad voor een anonieme coach.
-- SECURITY DEFINER → bypasst RLS, dus de body filtert strak:
--   * token moet bestaan, scope 'journal', niet revoked, niet verlopen;
--   * alleen live-journal-trades (backtest_project_id is null) van precies
--     de owner + het journal van de link (null-journal = alleen null-rijen,
--     identiek aan de scoping in useTrades);
--   * missed trades blijven server-side achter — hypothetisch, mag nooit in
--     echte performance lekken (domeinregel CLAUDE.md); de client filtert
--     met takenTrades() als tweede verdedigingslinie;
--   * de trade-JSON is een expliciete ALLOW-list (geen to_jsonb-minus): een
--     toekomstige trades-kolom lekt zo nooit stilzwijgend naar anon — nieuwe
--     kolommen delen is een bewuste wijziging hier. user_id en import_ref
--     ontbreken bewust;
--   * screenshot-kolommen: alleen externe URLs gaan mee. Bucket-paden zijn
--     `{user_id}/{uuid}.ext` — die zouden de owner-uuid alsnog naar andermans
--     browser sturen, en anon kan er toch geen signed URL voor minten
--     (storage-RLS 0039) → null;
--   * de methodologies-join eist m.user_id = l.user_id, zodat de naam van een
--     vreemd journal nooit teruggegeven wordt (zelfde reden als de with-check).
-- Geen rij (ongeldig/ingetrokken/verlopen token) → null, geen error — de
-- share-pagina toont dan één generieke "link ongeldig"-melding.
-- ---------------------------------------------------------
create or replace function get_shared_journal(share_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'journal_name', m.naam,
    'display_name', p.display_name,
    'result_unit', p.result_unit,
    'hide_fase', p.hide_fase,
    'trades', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', t.id,
          'fase', t.fase,
          'datum_open', t.datum_open,
          'datum_sluiting', t.datum_sluiting,
          'duur_dagen', t.duur_dagen,
          'pair', t.pair,
          'instrument', t.instrument,
          'direction', t.direction,
          'outcome', t.outcome,
          'resultaat_pct', t.resultaat_pct,
          'risk_pct', t.risk_pct,
          'trade_evaluation', t.trade_evaluation,
          'weekly_criteria', t.weekly_criteria,
          'weekly_kenmerk', t.weekly_kenmerk,
          'trade_concept', t.trade_concept,
          'entry', t.entry,
          'cc', t.cc,
          'sessie', t.sessie,
          'nieuws', t.nieuws,
          'w_confirm', t.w_confirm,
          'd_confirm', t.d_confirm,
          'h4_confirm', t.h4_confirm,
          'w_screenshot', case when t.w_screenshot ~* '^https?://' then t.w_screenshot end,
          'd_screenshot', case when t.d_screenshot ~* '^https?://' then t.d_screenshot end,
          'h4_screenshot', case when t.h4_screenshot ~* '^https?://' then t.h4_screenshot end,
          'h2_screenshot', case when t.h2_screenshot ~* '^https?://' then t.h2_screenshot end,
          'extra_d_conf', t.extra_d_conf,
          'notes', t.notes,
          'fase1_daily_respecteert_zone', t.fase1_daily_respecteert_zone,
          'fase1_spelers_verleden', t.fase1_spelers_verleden,
          'fase2_daily_respecteert_zone', t.fase2_daily_respecteert_zone,
          'fase2_structuur', t.fase2_structuur,
          'fase3_zone_min_2_touches', t.fase3_zone_min_2_touches,
          'fase3_engulfing_candle', t.fase3_engulfing_candle,
          'fase3_beide', t.fase3_beide,
          'fase3_structuur', t.fase3_structuur,
          'fase4_weekly_bevestigingscandle', t.fase4_weekly_bevestigingscandle,
          'weekly_review_id', t.weekly_review_id,
          'backtest_project_id', t.backtest_project_id,
          'methodology_id', t.methodology_id,
          'custom', t.custom,
          'created_at', t.created_at,
          'updated_at', t.updated_at
        ) order by t.datum_open, t.id)
        from trades t
        where t.user_id = l.user_id
          and t.backtest_project_id is null
          and t.methodology_id is not distinct from l.methodology_id
          and t.trade_evaluation is distinct from 'Missed trade'
      ),
      '[]'::jsonb
    )
  )
  from share_links l
  join profiles p on p.id = l.user_id
  left join methodologies m on m.id = l.methodology_id and m.user_id = l.user_id
  where l.token = share_token
    and l.scope = 'journal'
    and not l.revoked
    and (l.expires_at is null or l.expires_at > now());
$$;

-- Anon mag deze RPC bewust aanroepen — dat is het hele punt van de share-link.
-- (Les uit 0016/0038: default privileges grant EXECUTE aan anon sowieso; hier
-- expliciet i.p.v. impliciet, zodat de bedoeling in de migratie leesbaar is.)
revoke execute on function get_shared_journal(text) from public;
grant execute on function get_shared_journal(text) to anon, authenticated;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   select tablename, rowsecurity from pg_tables where tablename = 'share_links';    -- rowsecurity = t
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_name = 'share_links' and grantee = 'anon';                          -- 0 rijen
--   select proname, prosecdef from pg_proc where proname = 'get_shared_journal';      -- prosecdef = t
--   select get_shared_journal('bestaat-niet');                                        -- null
--   select indexname from pg_indexes where tablename = 'share_links';                 -- pkey, token-unique, idx_share_links_user_methodology
-- =========================================================
