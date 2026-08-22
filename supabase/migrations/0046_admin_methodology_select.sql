-- =========================================================
-- Beyen Invest — migration 0046: admin SELECT on methodologies (Fase R — H2)
--
-- The read-only admin debug view (AdminUserDetailPage → BacktestingAnalysisView)
-- renders journal-type-specific breakdowns (fase / forex / custom-field), driven
-- by the *viewed* user's active methodology + its fields. Those tables were added
-- in 0020, AFTER the is_admin() read-only carve-out of 0008, so they never got an
-- admin SELECT policy: an admin could only read the viewed user's journal when it
-- was a world-readable system template — for a user's OWN methodology, RLS
-- returned nothing and the breakdowns silently fell back to the admin's own
-- journal (H2). Add the same is_admin() SELECT carve-out these tables missed.
--
-- READ-ONLY, mirrors 0008: SELECT only, no write path for admins. system-template
-- rows stay world-readable via the existing *_system_select policies; this only
-- adds visibility of other users' own methodologies to admins.
--
-- `to authenticated` is REQUIRED, not cosmetic (the lesson of 0036): a policy with
-- no TO clause applies to anon too, and 0036 revoked anon's EXECUTE on is_admin().
-- An untargeted policy here would make every anon SELECT on these tables evaluate
-- is_admin() and fail with 42501 "permission denied for function is_admin". Scoping
-- to authenticated means anon never evaluates it (anon's own reads go through the
-- existing *_system_select policies, unchanged).
-- =========================================================

create policy "methodologies_admin_select" on methodologies
  for select to authenticated using (is_admin());

create policy "methodology_fields_admin_select" on methodology_fields
  for select to authenticated using (is_admin());
