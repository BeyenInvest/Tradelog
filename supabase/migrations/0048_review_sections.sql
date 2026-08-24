-- =========================================================
-- Beyen Invest — migration 0048: configureerbare review-secties per journal
-- (Fase N5)
--
-- Reviews hadden tot nu toe geen enkele configuratielaag: vaste kolommen
-- (verhalen/technisch/mentaal_*/acties/takeaway/overall_comment + het
-- periodieke periode_overzicht) met i18n-labels, hardgecodeerd in formulier,
-- weergave én PDF. Trades hebben die laag allang (methodology_fields +
-- trades.custom). Deze migratie brengt diezelfde machinerie naar reviews:
--
--   1. review_sections: per journal (methodology_id) + review-soort
--      (weekly/periodic) een geordende lijst secties met eigen label + type
--      (tekst/lijst). Géén rijen voor een soort ⇒ de client valt terug op de
--      ingebouwde default-set (src/lib/reviewSections.ts), dus bestaande
--      journals veranderen niets. Zodra er wél rijen zijn, vervangen die de
--      defaults volledig.
--   2. weekly_reviews.content / periodic_reviews.content (jsonb): de waarden van
--      de *eigen* secties, gekeyed op section_key — spiegelt trades.custom.
--      Ingebouwde secties blijven in hun eigen kolommen; alleen zelf-toegevoegde
--      secties landen hier. Geen data-migratie nodig: bestaande reviews houden
--      hun kolommen en renderen identiek.
--   3. fork_methodology kopieert voortaan ook de review_sections mee.
--   4. get_shared_review geeft nu de content-bag + de review_sections van het
--      journal mee, zodat een gedeelde review ook eigen secties toont.
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- =========================================================

-- ---------------------------------------------------------
-- 1. content-bags op de review-tabellen (mirror trades.custom)
-- ---------------------------------------------------------
alter table weekly_reviews
  add column if not exists content jsonb not null default '{}'::jsonb;
alter table periodic_reviews
  add column if not exists content jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------
-- 2. review_sections — de per-journal sectie-catalogus
-- ---------------------------------------------------------
create table if not exists review_sections (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references methodologies(id) on delete cascade,
  review_kind text not null check (review_kind in ('weekly', 'periodic')),
  -- Stabiele sleutel: een ingebouwde kolomnaam (verhalen/technisch/…) of een
  -- slug die de client in de content-bag opzoekt.
  section_key text not null,
  label text not null,
  -- Vertaal-sleutel voor de ingebouwde defaults (0047-stijl); null = eigen sectie.
  label_key text,
  input_type text not null check (input_type in ('text', 'list')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (methodology_id, review_kind, section_key)
);

create index if not exists idx_review_sections_methodology on review_sections(methodology_id);

alter table review_sections enable row level security;

-- Zichtbaar als het journal van jou is óf de ingebouwde systeemtemplate is
-- (zoals methodology_fields_select); schrijven alleen op je eigen journal.
drop policy if exists "review_sections_select" on review_sections;
create policy "review_sections_select" on review_sections
  for select using (exists (
    select 1 from methodologies m where m.id = review_sections.methodology_id
      and (m.user_id = auth.uid() or (m.is_system and m.user_id is null))));

drop policy if exists "review_sections_write" on review_sections;
create policy "review_sections_write" on review_sections
  for all using (exists (
    select 1 from methodologies m where m.id = review_sections.methodology_id and m.user_id = auth.uid()))
  with check (exists (
    select 1 from methodologies m where m.id = review_sections.methodology_id and m.user_id = auth.uid()));

-- Admin read-only carve-out (0046-patroon): `to authenticated` zodat anon nooit
-- is_admin() evalueert (zie 0036).
drop policy if exists "review_sections_admin_select" on review_sections;
create policy "review_sections_admin_select" on review_sections
  for select to authenticated using (is_admin());

-- ---------------------------------------------------------
-- 3. fork_methodology: kopieer óók de review-secties naar de nieuwe kopie.
-- Ongewijzigd t.o.v. 0047 op één insert-blok na. (create or replace)
-- ---------------------------------------------------------
create or replace function fork_methodology(source_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into methodologies (user_id, naam, is_system, asset_class, instrument_config)
  select auth.uid(), naam, false, asset_class, instrument_config
  from methodologies where id = source_id
  returning id into new_id;

  if new_id is null then
    raise exception 'source methodology % not found or not visible', source_id;
  end if;

  insert into methodology_fields
    (methodology_id, fase_id, field_key, label, label_key, field_type, options, is_computed,
     group_label, group_key, required, show_when_values, sort_order)
  select new_id, null, field_key, label, label_key, field_type, options, is_computed,
         group_label, group_key, required, show_when_values, sort_order
  from methodology_fields where methodology_id = source_id;

  update methodology_fields nf
  set show_when_field_id = np.id
  from methodology_fields sf
  join methodology_fields sp on sp.id = sf.show_when_field_id
  join methodology_fields np on np.methodology_id = new_id and np.field_key = sp.field_key
  where sf.methodology_id = source_id
    and nf.methodology_id = new_id
    and nf.field_key = sf.field_key;

  -- N5: neem de configureerbare review-secties mee de fork in.
  insert into review_sections
    (methodology_id, review_kind, section_key, label, label_key, input_type, sort_order)
  select new_id, review_kind, section_key, label, label_key, input_type, sort_order
  from review_sections where methodology_id = source_id;

  return new_id;
end;
$$;

revoke all on function fork_methodology(uuid) from public;
grant execute on function fork_methodology(uuid) to authenticated;

-- ---------------------------------------------------------
-- 4a. shared_review_sections(mid, owner, kind): de sectie-definities van het
-- gedeelde journal, voor de custom-secties in de gedeelde review. Allow-list
-- (geen timestamps); de methodologies-join eist de owner, zodat een RPC-bug
-- nooit secties van een vreemd journal teruggeeft. null journal → [].
-- Niet voor anon aanroepbaar — alleen de definer-RPC gebruikt hem.
-- ---------------------------------------------------------
create or replace function shared_review_sections(mid uuid, owner_id uuid, kind text)
returns jsonb
language sql
stable
as $$
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'section_key', s.section_key,
        'label', s.label,
        'label_key', s.label_key,
        'input_type', s.input_type,
        'sort_order', s.sort_order
      ) order by s.sort_order, s.section_key)
      from review_sections s
      join methodologies m on m.id = s.methodology_id
      where s.methodology_id = mid and m.user_id = owner_id and s.review_kind = kind
    ),
    '[]'::jsonb
  );
$$;

revoke all on function shared_review_sections(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 4b. get_shared_review: zelfde contract als 0042, nu met de content-bag in de
-- review-JSON én een top-level 'sections'-blok (leeg = default-set, client
-- resolvet dan de defaults net als de eigenaar zelf). Alle 0042-regels blijven
-- gelden (strakke join op r.user_id = l.user_id, missed trades gaan mee,
-- generiek null bij ongeldig/ingetrokken/verlopen). (create or replace)
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
          'sections', shared_review_sections(r.methodology_id, l.user_id, 'weekly'),
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
            'overall_comment', r.overall_comment,
            'content', r.content
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
          'sections', shared_review_sections(r.methodology_id, l.user_id, 'periodic'),
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
            'periode_overzicht', r.periode_overzicht,
            'content', r.content
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

revoke execute on function get_shared_review(text) from public;
grant execute on function get_shared_review(text) to anon, authenticated;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   select column_name from information_schema.columns
--     where table_name in ('weekly_reviews','periodic_reviews') and column_name = 'content';  -- 2 rijen
--   select count(*) from information_schema.tables where table_name = 'review_sections';       -- 1
--   select polname from pg_policies where tablename = 'review_sections';
--     -- review_sections_select / _write / _admin_select
--   select proname from pg_proc where proname = 'shared_review_sections';                      -- 1
--   select prosecdef from pg_proc where proname = 'get_shared_review';                         -- t
--   select get_shared_review('bestaat-niet');                                                  -- null
-- =========================================================
