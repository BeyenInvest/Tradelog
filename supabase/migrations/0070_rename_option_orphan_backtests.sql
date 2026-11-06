-- =========================================================
-- Beyen Invest — migration 0070: optie hernoemen neemt ook backtest-trades
-- zonder journal mee.
--
-- Waarom (owner-wens 2026-11-06): de veld-editor in Settings kan nu de naam van
-- een keuzelijst-optie aanpassen. De bestaande RPC rename_field_option (0045,
-- 0059) past de optielijst, show_when-voorwaarden en trades.custom in één keer
-- aan, maar raakt alleen trades met methodology_id = dit journal.
--
-- Backtest-projecten hangen niet aan een journal, dus hun trades kunnen
-- methodology_id = null hebben én toch antwoorden dragen:
--   * CSV-imports van vóór 0059: die kregen custom.fase/cc uit de oude kolommen;
--   * trades van een journal dat vóór 0062 is verwijderd (SET NULL).
-- De project-analyse leest die trades met de velden van het actieve journal, dus
-- zonder deze fix blijft zo'n trade na een hernoeming op de oude naam staan en
-- valt hij in een eigen rijtje naast de nieuwe naam.
--
-- Wat: stap 3 van de RPC pakt voortaan ook deze trades van de eigen gebruiker.
-- Alleen backtest-trades: een live trade zonder journal is onzichtbaar en hoort
-- bij geen enkel journal. Handtekening, rechten en SECURITY INVOKER blijven
-- gelijk (elke UPDATE blijft door de RLS van de aanroeper gaan).
--
-- Idempotent: create or replace. De frontend werkt ook zonder deze migratie;
-- dan blijven alleen die trades achter.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0070_rename_option_orphan_backtests.sql
-- =========================================================

create or replace function rename_field_option(p_field_id uuid, p_old_value text, p_new_value text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_field methodology_fields%rowtype;
  v_new text := btrim(p_new_value);
  v_migrated integer := 0;
begin
  -- Lock the field row for the duration so two concurrent renames of the same
  -- field serialize instead of interleaving their option-list rewrites.
  select f.* into v_field
  from methodology_fields f
  join methodologies m on m.id = f.methodology_id
  where f.id = p_field_id
    and m.user_id = auth.uid()
    and not m.is_system
  for update of f;

  if not found then
    raise exception 'field not found or not editable' using errcode = 'P0002';
  end if;
  if v_field.field_type <> 'enum' or v_field.options is null or not (v_field.options ? p_old_value) then
    raise exception 'option not found' using errcode = 'P0002';
  end if;
  if v_new = '' or v_new = p_old_value then
    return 0;
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_field.options) as o(val)
    where o.val <> p_old_value and lower(o.val) = lower(v_new)
  ) then
    raise exception 'option already exists' using errcode = '23505';
  end if;

  -- 1. The option list itself, position preserved.
  update methodology_fields
  set options = (
    select jsonb_agg(case when o.val = p_old_value then to_jsonb(v_new) else to_jsonb(o.val) end order by o.ord)
    from jsonb_array_elements_text(v_field.options) with ordinality as o(val, ord)
  )
  where id = p_field_id;

  -- 2. Sibling fields whose show_when condition references the old value —
  -- without this, a rename would silently break conditional visibility.
  update methodology_fields f
  set show_when_values = (
    select jsonb_agg(case when s.val = p_old_value then to_jsonb(v_new) else to_jsonb(s.val) end order by s.ord)
    from jsonb_array_elements_text(f.show_when_values) with ordinality as s(val, ord)
  )
  where f.show_when_field_id = p_field_id
    and f.show_when_values ? p_old_value;

  -- 3. Migrate stored answers: every trade of this journal holding the old
  -- value in its custom bag, plus the user's backtest trades without a journal
  -- (0070) — the project analysis reads those with the active journal's fields.
  update trades t
  set custom = jsonb_set(t.custom, array[v_field.field_key], to_jsonb(v_new))
  where t.user_id = auth.uid()
    and (t.methodology_id = v_field.methodology_id
         or (t.methodology_id is null and t.backtest_project_id is not null))
    and t.custom ->> v_field.field_key = p_old_value;
  get diagnostics v_migrated = row_count;

  return v_migrated;
end;
$$;

revoke all on function rename_field_option(uuid, text, text) from public, anon;
grant execute on function rename_field_option(uuid, text, text) to authenticated;

insert into schema_migrations (filename) values ('0070_rename_option_orphan_backtests.sql')
on conflict do nothing;

-- Read-only check na het draaien (verwacht: true):
--   select prosrc like '%t.methodology_id is null and t.backtest_project_id is not null%'
--   from pg_proc where proname = 'rename_field_option';
