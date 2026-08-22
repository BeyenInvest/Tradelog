-- =========================================================
-- Beyen Invest — migration 0045: transactional option rename (Fase R — M5)
--
-- renameFieldOption (useMethodology.tsx) used to run 3+N separate client
-- writes: the option list, each sibling show_when condition, then every trade
-- whose custom bag holds the old value, in chunks. A network failure halfway
-- left a half-migrated journal: renamed option list, but old values still in
-- trades — history split into two buckets with no way to tell. This RPC does
-- the whole rename in ONE function call, so it is atomic: any error rolls all
-- of it back.
--
-- SECURITY INVOKER (default): every UPDATE inside re-checks the caller's RLS
-- (methodology_fields_write requires an own methodology; trades_owner_all
-- requires own rows), so the function cannot touch anyone else's data even if
-- the explicit ownership check were bypassed.
--
-- Mirrors the client-side guards it replaces:
--   - own, non-system methodology only
--   - `fase` refuses (legacy: trades.fase is still a Postgres enum — the
--     client's isLockedLegacyField guard, enforced server-side)
--   - enum field, old value must exist
--   - blank/unchanged new value → no-op (returns 0)
--   - case-insensitive collision with another option refuses (a case-only
--     change of the same option is fine)
--
-- Idempotent / re-runnable: create-or-replace + grants converge.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0045_rename_field_option.sql
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
  if v_field.field_key = 'fase' then
    raise exception 'legacy field is locked' using errcode = '23514';
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
  -- value in its custom bag. One statement — no 1000-row pagination, no chunks.
  update trades t
  set custom = jsonb_set(t.custom, array[v_field.field_key], to_jsonb(v_new))
  where t.user_id = auth.uid()
    and t.methodology_id = v_field.methodology_id
    and t.custom ->> v_field.field_key = p_old_value;
  get diagnostics v_migrated = row_count;

  return v_migrated;
end;
$$;

-- Same grant hygiene as the other RPCs (0036/0038/0044): nothing for anon.
revoke all on function rename_field_option(uuid, text, text) from public;
revoke all on function rename_field_option(uuid, text, text) from anon;
grant execute on function rename_field_option(uuid, text, text) to authenticated;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--
--   select proname, prosecdef from pg_proc where proname = 'rename_field_option';
--   -- verwacht: 1 rij, prosecdef = false (security invoker)
--
--   select grantee, privilege_type from information_schema.routine_privileges
--   where routine_name = 'rename_field_option';
--   -- verwacht: alleen authenticated (en postgres/owner), géén anon
-- =========================================================
