-- =========================================================
-- Beyen Invest — migration 0042: review-sharing + custom-velden in share-payloads
-- (Fase M sessie 2)
--
-- Bouwt voort op 0040 (share_links + get_shared_journal). Drie dingen:
--   1. scope 'review': een owner deelt één weekly óf periodic review via een
--      token-URL (/share/review/:token). Twee aparte nullable FK-kolommen
--      (weekly_review_id / periodic_review_id, on delete cascade) i.p.v. één
--      polymorf id — echte referentiële integriteit, en een verwijderde review
--      trekt zijn links automatisch in.
--   2. get_shared_review(token): het anonieme leespad voor een review-link.
--      Levert de review-content + de bijbehorende trades. Anders dan de
--      journal-share gaan missed trades hier WEL mee: de review-weergave toont
--      ze bewust als aparte, gebadgede groep (hypothetisch, nooit in echte
--      stats — de client splitst met takenTrades()/missedTrades(), zoals elke
--      review-view).
--   3. get_shared_journal geeft nu ook de methodology_fields van het journal
--      mee ('fields'), zodat de gedeelde trade-detail-modal custom velden met
--      hun eigen labels kan tonen i.p.v. alleen de vaste WPM-kolommen. De
--      review-share heeft geen trade-detail-modal en verstuurt dus geen fields.
--
-- De trade-JSON-allow-list is naar een eigen helper getild
-- (shared_trade_json) zodat beide RPC's gegarandeerd dezelfde kolommen
-- prijsgeven — één eigenaar, geen tweede lijst die stil kan afwijken.
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- =========================================================

-- ---------------------------------------------------------
-- 1a. scope-CHECK versoepelen + review-FK-kolommen
-- ---------------------------------------------------------
alter table share_links drop constraint if exists share_links_scope_check;
alter table share_links add constraint share_links_scope_check
  check (scope in ('journal', 'review'));

alter table share_links
  add column if not exists weekly_review_id uuid references weekly_reviews(id) on delete cascade;
alter table share_links
  add column if not exists periodic_review_id uuid references periodic_reviews(id) on delete cascade;

-- scope en review-verwijzing horen bij elkaar: een journal-link verwijst nooit
-- naar een review; een review-link naar precies één van de twee tabellen.
alter table share_links drop constraint if exists share_links_scope_refs_check;
alter table share_links add constraint share_links_scope_refs_check
  check (
    (scope = 'journal' and weekly_review_id is null and periodic_review_id is null)
    or (scope = 'review'
        and ((weekly_review_id is not null)::int + (periodic_review_id is not null)::int = 1))
  );

-- FK-index-conventie (vgl. idx_share_links_user_methodology in 0040): dekt de
-- cascade-check bij het verwijderen van een review. Partieel — vrijwel elke rij
-- is een journal-link met null hier.
create index if not exists idx_share_links_weekly_review
  on share_links(weekly_review_id) where weekly_review_id is not null;
create index if not exists idx_share_links_periodic_review
  on share_links(periodic_review_id) where periodic_review_id is not null;

-- ---------------------------------------------------------
-- 1b. RLS: with-check eist óók dat de gedeelde review van de inserter zelf is —
-- zelfde reden als de methodologies-subquery in 0040 (de kale FK wordt als
-- table-owner gecheckt en bypasst review-RLS, dus zonder deze subquery zou een
-- geldige vreemde review-uuid geaccepteerd worden en via de RPC andermans
-- review-content prijsgeven).
-- ---------------------------------------------------------
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
    and (
      weekly_review_id is null
      or exists (
        select 1 from weekly_reviews r
        where r.id = weekly_review_id and r.user_id = auth.uid()
      )
    )
    and (
      periodic_review_id is null
      or exists (
        select 1 from periodic_reviews r
        where r.id = periodic_review_id and r.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------
-- 2a. shared_trade_json(t): de ENE trade-allow-list voor alle share-RPC's.
-- Zelfde regels als de inline lijst uit 0040 (die get_shared_journal hieronder
-- vervangt): geen user_id/import_ref; screenshot-kolommen alleen als externe
-- URL (bucket-paden bevatten de owner-uuid en zijn voor anon toch niet te
-- signen — 0039). Een nieuwe trades-kolom delen = een bewuste wijziging hier.
-- Niet voor anon aanroepbaar — alleen de definer-RPC's gebruiken hem.
-- ---------------------------------------------------------
create or replace function shared_trade_json(t trades)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
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
  );
$$;

revoke all on function shared_trade_json(trades) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 2b. shared_methodology_fields(mid, owner): veld-definities (labels) van het
-- gedeelde journal, voor de custom-veld-rijen in de trade-detail-modal.
-- Allow-list: geen show_when/required — puur wat weergave nodig heeft. De
-- methodologies-join eist de owner, zodat een RPC-bug nooit velddefinities van
-- een vreemd journal kan teruggeven. null journal (legacy) → [].
-- ---------------------------------------------------------
create or replace function shared_methodology_fields(mid uuid, owner_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'field_key', f.field_key,
        'label', f.label,
        'field_type', f.field_type,
        'options', to_jsonb(f.options),
        'group_label', f.group_label,
        'is_computed', f.is_computed,
        'sort_order', f.sort_order
      ) order by f.sort_order, f.field_key)
      from methodology_fields f
      join methodologies m on m.id = f.methodology_id
      where f.methodology_id = mid and m.user_id = owner_id
    ),
    '[]'::jsonb
  );
$$;

revoke all on function shared_methodology_fields(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 2c. get_shared_journal: zelfde contract als 0040, nu via shared_trade_json
-- + het nieuwe 'fields'-blok. Alle 0040-regels blijven gelden (alleen
-- live-journal-trades van precies dat user_id+methodology_id, missed trades
-- blijven server-side achter, generiek null bij ongeldig/ingetrokken/verlopen).
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
    'fields', shared_methodology_fields(l.methodology_id, l.user_id),
    'trades', coalesce(
      (
        select jsonb_agg(shared_trade_json(t) order by t.datum_open, t.id)
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

revoke execute on function get_shared_journal(text) from public;
grant execute on function get_shared_journal(text) to anon, authenticated;

-- ---------------------------------------------------------
-- 2d. get_shared_review(token): het enige leespad voor een gedeelde review.
-- SECURITY DEFINER → de body filtert strak:
--   * token moet bestaan, scope 'review', niet revoked, niet verlopen;
--   * de review-joins eisen r.user_id = l.user_id (defense-in-depth naast de
--     with-check — zelfde patroon als de methodologies-join in 0040);
--   * weekly: de gelinkte trades via trades.weekly_review_id (de FK waarmee de
--     app zelf linkt), plus dezelfde journal-scoping als de periodic-tak —
--     defensief, voor het geval een legacy/handmatige relink ooit een
--     cross-journal FK heeft achtergelaten; periodic: datum_open binnen de
--     kalenderperiode van de review + journal-scoping (is not distinct from);
--   * missed trades gaan mee (zie kop) — de client toont ze gebadged en houdt
--     ze uit de stats, identiek aan de eigen review-weergave;
--   * review-JSON is een expliciete allow-list (geen user_id).
-- Geen rij → null, geen error — de share-pagina toont één generieke melding.
-- ---------------------------------------------------------
create or replace function get_shared_review(share_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when l.weekly_review_id is not null then
      (
        select jsonb_build_object(
          'kind', 'weekly',
          'journal_name', (select m.naam from methodologies m where m.id = r.methodology_id and m.user_id = l.user_id),
          'display_name', p.display_name,
          'result_unit', p.result_unit,
          'hide_fase', p.hide_fase,
          'review', jsonb_build_object(
            'id', r.id,
            'week_nummer', r.week_nummer,
            'jaar', r.jaar,
            'titel', r.titel,
            'verhalen', r.verhalen,
            'technisch', r.technisch,
            'mentaal_owner', r.mentaal_owner,
            'mentaal_trader', r.mentaal_trader,
            'acties', to_jsonb(r.acties),
            'takeaway', r.takeaway,
            'overall_comment', r.overall_comment
          ),
          'trades', coalesce(
            (
              select jsonb_agg(shared_trade_json(t) order by t.datum_open, t.id)
              from trades t
              where t.user_id = l.user_id
                and t.weekly_review_id = r.id
                and t.backtest_project_id is null
                and t.methodology_id is not distinct from r.methodology_id
            ),
            '[]'::jsonb
          )
        )
        from weekly_reviews r
        where r.id = l.weekly_review_id and r.user_id = l.user_id
      )
    else
      (
        select jsonb_build_object(
          'kind', 'periodic',
          'journal_name', (select m.naam from methodologies m where m.id = r.methodology_id and m.user_id = l.user_id),
          'display_name', p.display_name,
          'result_unit', p.result_unit,
          'hide_fase', p.hide_fase,
          'review', jsonb_build_object(
            'id', r.id,
            'period_type', r.period_type,
            'jaar', r.jaar,
            'periode_nummer', r.periode_nummer,
            'titel', r.titel,
            'technisch', r.technisch,
            'mentaal_owner', r.mentaal_owner,
            'mentaal_trader', r.mentaal_trader,
            'acties', to_jsonb(r.acties),
            'takeaway', r.takeaway,
            'overall_comment', r.overall_comment,
            'periode_overzicht', r.periode_overzicht
          ),
          -- Kalenderperiode identiek aan rangeOfPeriod() client-side
          -- (src/lib/periodRanges.ts): maand / kwartaal / jaar, inclusieve grenzen.
          'trades', coalesce(
            (
              select jsonb_agg(shared_trade_json(t) order by t.datum_open, t.id)
              from trades t
              where t.user_id = l.user_id
                and t.backtest_project_id is null
                and t.methodology_id is not distinct from r.methodology_id
                and t.datum_open >= case r.period_type
                    when 'month' then make_date(r.jaar, r.periode_nummer, 1)
                    when 'quarter' then make_date(r.jaar, (r.periode_nummer - 1) * 3 + 1, 1)
                    else make_date(r.jaar, 1, 1)
                  end
                and t.datum_open <= case r.period_type
                    when 'month' then (make_date(r.jaar, r.periode_nummer, 1) + interval '1 month - 1 day')::date
                    when 'quarter' then (make_date(r.jaar, (r.periode_nummer - 1) * 3 + 1, 1) + interval '3 months - 1 day')::date
                    else make_date(r.jaar, 12, 31)
                  end
            ),
            '[]'::jsonb
          )
        )
        from periodic_reviews r
        where r.id = l.periodic_review_id and r.user_id = l.user_id
      )
  end
  from share_links l
  join profiles p on p.id = l.user_id
  where l.token = share_token
    and l.scope = 'review'
    and not l.revoked
    and (l.expires_at is null or l.expires_at > now());
$$;

-- Anon mag deze RPC bewust aanroepen — zelfde redenering als get_shared_journal.
revoke execute on function get_shared_review(text) from public;
grant execute on function get_shared_review(text) to anon, authenticated;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   select conname from pg_constraint where conrelid = 'share_links'::regclass;
--     -- bevat share_links_scope_check + share_links_scope_refs_check
--   select column_name from information_schema.columns
--     where table_name = 'share_links' and column_name like '%review%';           -- 2 rijen
--   select proname, prosecdef from pg_proc
--     where proname in ('get_shared_review','shared_trade_json','shared_methodology_fields');
--     -- get_shared_review: prosecdef = t; helpers: f
--   select grantee from information_schema.role_routine_grants
--     where routine_name = 'shared_trade_json' and grantee = 'anon';              -- 0 rijen
--   select get_shared_review('bestaat-niet');                                     -- null
--   select get_shared_journal('bestaat-niet');                                    -- null (herschapen, nog steeds dicht)
-- =========================================================
