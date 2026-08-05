-- =========================================================
-- Beyen Invest — migration: per-user custom "Entry" options
--
-- Some account holders trade with entry setups outside the fixed ENTRIES
-- list (constants.ts) and don't want their own 3-4 extra values added to
-- the shared list everyone else sees. `custom_options` lets a user register
-- their own extra values for a given form field — merged into the <select>
-- client-side (see useCustomOptions, EntrySection.tsx) on top of the fixed
-- list, without touching it for anyone else.
--
-- `trades.entry` moves off the native `entry_enum` to plain `text` because
-- a Postgres enum type is fixed at the database level and can't hold
-- per-user values — this is a deliberate, narrow exception to this
-- project's usual "one shared enum, no free text" rule (see validation.ts),
-- scoped to just this one field. The <select> in EntrySection.tsx (fixed
-- list + that user's own custom_options rows) is still the only way to set
-- it from the UI.
--
-- No dedicated RLS needed for the column change (existing trades_owner_all
-- policy already covers it). custom_options gets its own owner-only policy.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

alter table trades alter column entry type text using entry::text;
drop type entry_enum;

create table custom_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  field text not null, -- form field this option belongs to, e.g. 'entry'
  value text not null,
  created_at timestamptz not null default now(),
  unique (user_id, field, value)
);

alter table custom_options enable row level security;

create policy "custom_options_owner_all" on custom_options
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
