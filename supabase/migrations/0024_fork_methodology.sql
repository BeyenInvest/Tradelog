-- =========================================================
-- Beyen Invest — migration 0024: fork_methodology RPC (Scope C, cyclus 2)
--
-- Fork-on-edit: system templates (Archer, is_system, user_id null) are read-only.
-- When a user first edits their journal, the client calls fork_methodology(source)
-- to make a personal, editable copy (methodology + all its fields) and then
-- repoints profiles.methodology_id at the copy. This RPC does that copy atomically,
-- correctly remapping the self-referential show_when_field_id conditions by
-- field_key (which is unique per methodology since 0023).
--
-- SECURITY INVOKER: RLS still applies — the caller can read the source (system
-- templates are world-readable), insert a methodology owned by themselves, and
-- insert its fields. The new methodology is owned by auth.uid().
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0024_fork_methodology.sql
-- =========================================================

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

  -- 1. Copy the methodology as the caller's own (never a system template).
  insert into methodologies (user_id, naam, is_system, asset_class, instrument_config)
  select auth.uid(), naam, false, asset_class, instrument_config
  from methodologies
  where id = source_id
  returning id into new_id;

  if new_id is null then
    raise exception 'source methodology % not found or not visible', source_id;
  end if;

  -- 2. Copy the fields, minus the self-referential show_when_field_id for now.
  insert into methodology_fields
    (methodology_id, fase_id, field_key, label, field_type, options, is_computed,
     group_label, required, show_when_values, sort_order)
  select new_id, null, field_key, label, field_type, options, is_computed,
         group_label, required, show_when_values, sort_order
  from methodology_fields
  where methodology_id = source_id;

  -- 3. Remap show_when_field_id: a copied field's condition should point at the
  --    copy of the same parent (matched by field_key, unique per methodology).
  update methodology_fields nf
  set show_when_field_id = np.id
  from methodology_fields sf
  join methodology_fields sp on sp.id = sf.show_when_field_id            -- source parent
  join methodology_fields np on np.methodology_id = new_id and np.field_key = sp.field_key  -- new parent
  where sf.methodology_id = source_id
    and nf.methodology_id = new_id
    and nf.field_key = sf.field_key;

  return new_id;
end;
$$;

revoke all on function fork_methodology(uuid) from public;
grant execute on function fork_methodology(uuid) to authenticated;
