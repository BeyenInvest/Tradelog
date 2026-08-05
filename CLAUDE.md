# Beyen Invest (Tradelog)

Trading & backtesting journal. React + Vite + TypeScript + Tailwind, Supabase (Postgres + Auth), deployed on Vercel.

- Production: https://beyen.app (custom domain via Combell DNS → Vercel; underlying deployment still reachable at https://tradelog-three-alpha.vercel.app)
- GitHub: BeyenInvest/Tradelog
- Full product spec: `beyen-invest-spec.md`
- Setup/ops instructions: `README.md` (Supabase bootstrap, env vars, signup rollout steps)

## Domain rules (non-obvious, easy to violate accidentally)

- `trade_evaluation` enum (`src/lib/constants.ts`): `"Good trade" | "Emotional error" | "Technical error" | "Missed trade"`. This is *execution quality*, separate from `outcome` (`Win/Loss/BE`, the actual P&L).
- **"Missed trade" is hypothetical** — a setup seen but never taken, logged with a hypothetical `resultaat_pct`. It must never dilute real performance numbers (resultaat, win-rate, streaks, drawdown, review stats, equity curves, ...). Every view enforces this through the shared helpers in `src/lib/stats/core.ts` — `isMissed()`, `takenTrades()`, `missedTrades()` — rather than re-filtering locally. When adding any new stat, route it through these, don't hand-roll a filter.
- Not selectable within a backtest project — `ResultSection.tsx` hides both the "Trade evaluation" and "TPFS %" fields entirely there (gated on the same `allowMissedTrade` flag), since neither is meaningful outside the live Journal.
- `round2()` in `core.ts` normalizes `-0` to `0` — needed because `Math.round` on an exact-zero negative sum can yield `-0`, which breaks both `toEqual` in tests and risks rendering "-0%" in the UI.
- `profiles.hide_fase` (per-user, toggled on `/settings`, exposed as `hideFase` from `useAuth`) hides every fase-related field/column/breakdown from that user's UI (trade form, filters, journal list, backtesting analysis). It's a display-only toggle — `trades.fase` stays `not null` in the DB (defaults to `"Fase 1"` silently via a hidden form field), the fixed 4-fasen system itself is unchanged. Any new fase-related UI should check this flag the same way.
- `custom_options` table (`user_id`, `field`, `value`) lets a user register their own extra values for a fixed-list form field without touching the shared constant list — currently wired up only for `entry` (`useCustomOptions("entry")`, merged into the Entry `<select>` in `EntrySection.tsx`). This is why `trades.entry` is plain `text`, not a native Postgres enum like every other categorical column, and why `tradeSchema`'s `entry` field is a nullable string instead of `z.enum(ENTRIES)` — a deliberate, narrow exception to this project's "one shared enum, no free text" rule, scoped to just this field. Extend the same pattern (new `field` value + a merge in the relevant section) before ever adding a one-off entry to a shared constants.ts list for a single user.

## Architecture conventions

- `src/lib/stats/` — all calculation logic (streaks, drawdown, expectancy, per-dimension breakdowns, TPFS) lives here as pure functions. Views read from this, nothing gets recomputed inline. `computeOverviewKpis()` in `core.ts` is the single entry point for the Overview KPI row.
- `TradesApi` (from `useTrades`) is owned by the page and passed down as a single shared instance — don't create a second instance for a subtree, that would desync trade state.
- Streak rule: BE pauses a streak (no reset, no increment), only Win/Loss break it.
- Drawdown/equity curve: chronological by `datum_open`, tie-broken by `id`, via `sortChronological()`.
- Fase-specific fields (`FASE_KENMERKEN` in `constants.ts`) are config-driven so the Backtesting breakdown UI renders every fase-kenmerk via one `.map()` instead of hand-written blocks per fase.

## Auth / multi-tenant status

Multi-tenant signup is **built**, not hypothetical: `profiles` table + auto-provisioning trigger (`supabase/schema.sql`), `/signup`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy` all exist and are routed (`src/router.tsx`), `useAuth.tsx` has `signUp`/`sendPasswordReset`/`updatePassword`. RLS is scoped per-user (`user_id = auth.uid()`) on every table.

**Public registration is currently gated off** — `supabase.auth.signUp` will error until the owner completes the rollout steps in README.md §5 (Turnstile site, Supabase CAPTCHA protection, URL config, "Allow new users to sign up" toggle). Until then, new accounts are created manually via the Supabase dashboard.

**Turnstile/CAPTCHA is temporarily fully disabled** (both `VITE_TURNSTILE_SITE_KEY` on Vercel and Supabase's CAPTCHA protection toggle) to allow the owner's real Chrome *and* this session's sandboxed Browser pane to load the app during active development — the widget previously crashed the Browser pane. `CaptchaWidget.tsx` already renders `null` with no site key, so this needed no code change. **Before public launch this must be re-enabled** (see README.md §5) — at that point, opening the production URL in the Browser pane needs re-confirmation with the user first (Turnstile is suspected incompatible with it).

Terms/Privacy pages are placeholder copy only, not legally reviewed — flag this if asked about launch readiness.

## Deliberately out of scope for now (don't build unprompted)

- Per-user configurable trading methodology (e.g. custom fase/entry/concept lists) — every user still gets the same fixed "4 fasen" system and constant lists (`constants.ts`). Only the display of fasen is now user-toggleable (`hide_fase`, see Domain rules), not the methodology itself.
- Stripe/billing — `profiles.plan` defaults to `'free'` as the only hook for this later.
- Migration from the old Google Sheets workflow, MAE/MFE tracking, discipline/execution tracking, live broker integration. See spec §7-8.

## Workflow preferences

- Only commit/push when the user explicitly asks — even mid-feature-work, don't assume approval carries forward.
- Prefer `git revert` over `git reset --hard` on shared branches; never force-push to `main`.
- Before any risky/destructive git operation, create and push a backup branch first if there's any chance of losing work.
- Run `npm run lint` (`tsc --noEmit`), `npm run test`, and `npm run build` clean before considering a change done.
