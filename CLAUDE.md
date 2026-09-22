# Beyen Invest (Tradelog)

Trading & backtesting journal. React + Vite + TypeScript + Tailwind, Supabase (Postgres + Auth), deployed on Vercel.

- Production: https://beyen.app (custom domain via Combell DNS → Vercel; underlying deployment still reachable at https://tradelog-three-alpha.vercel.app)
- GitHub: BeyenInvest/Tradelog
- Product domain rules & non-obvious conventions: this file (see the Domain rules section below)
- Setup/ops instructions: `README.md` (Supabase bootstrap, env vars, signup rollout steps)

## Current plan & feature-freeze (2026-09-09)

- **Leidend plan = `docs/fixplan-2026-09.md`** (blokken A–H, n.a.v. `docs/meta-audit-2026-09.md`). Het vervangt masterplan-launch.md. Werk nooit uit een ander plandocument zonder het fixplan te checken.
- **Totale feature-freeze tot na de beta-launch** (owner-besluit 2026-09-09): geen nieuwe features, geen nieuwe migraties buiten het fixplan. Bevroren oppervlakken (ook geen "kleine" commits): Habits, Dagboek, Review-PDF, MAE/MFE-laag, EN-copy-uitbreiding. Ontdooien = expliciete owner-beslissing in het fixplan.
- **Uitzondering (owner-besluit 2026-09-15/16): de TradingView-extensie.** Leidend plan = `docs/plan-tv-extensie-engines.md` (bouwlog in §6); S0 ✅ + **F1a–F4a GEMERGED op main + live** (PR #9, 2026-09-17; migratie **0058** gedraaid op prod): koppel-endpoint (`api/extension-link.ts`), Settings-kaart, MV3-extensie in `extension/` (auth, chart-adapter, log-paneel, snapshots; `npm run build:ext`, laden = unpacked op `extension/`), security-review gedaan (closed shadow root). Open: owner-test in echte Chrome (checklist plan-doc §6) + F4b polish/Store. **Un-gate 2026-09-19 (owner-besluit): de extensie is uit de beta-gate — koppelkaart (`ExtensionLinkCard`), Gids-sectie én het `api/extension-link.ts`-endpoint zijn nu open voor álle ingelogde leden** (branch `ungate-tv-extensie`, PR openstaand; auth + per-user rate-limit blijven). ⚠️ De Store-listing staat nog op v0.2.0 *review-pending*, dus leden kunnen pas installeren zodra die review door is. Model-per-fase geldt (Fable: auth/adapter/migraties/security, Opus: UI).
- **Uitzondering (owner-besluit 2026-09-18): WPM fase-retirement — de "cyclus 10"-sanering, nu als big-bang.** Het legacy Weekly-Phase-Method-systeem is uit de hardcoded laag gehaald: `trades.fase` + de 9 kenmerk-kolommen + `weekly_*`/`cc`/`trade_concept`/`entry`/confirms/`nieuws` zijn gedropt en verhuisd naar `trades.custom` (migratie **0059**, backfill-vóór-drop met sanity-checks). WPM is nu een gewoon config-journal via de **`wpm`-strategie-startset** (naast ICT/SMC). `hide_fase`, `isLegacyMethodology`, de per-fase-analyse en de fase-kenmerk-invulvelden zijn wég (kenmerk-DATA blijft bewaard in `custom`, conform het 2026-09-17-besluit ze verborgen te houden). Branch `wpm-fase-retirement`, CI groen (lint/test/build/build:ext). ⚠️ **Owner moet 0059 draaien op prod (met backup/PITR) én de PR mergen** — migratie-eerst-dan-deploy (0043-les).
- **"Klaar" = gemerged op main + docs/CLAUDE.md bijgewerkt + afgevinkt in het fixplan** — niet "code groen op een branch". Eén sessie = één branch = één blok; max 1 open werkstroom tegelijk.
- Migratienummers: nooit hergebruiken; elke migratie werkt `supabase/schema.sql` mee bij. **0059** = WPM fase-retirement (staat klaar op branch, owner draait 'm). **0060** = per-journal aanpasbare screenshot-slot-namen (`methodologies.screenshot_labels`, branch `methodology-editor-flexibiliteit`; owner draait 'm vóór deploy). Eerstvolgend vrij nummer = **0061**.

## Domain rules (non-obvious, easy to violate accidentally)

- `trade_evaluation` enum (`src/lib/constants.ts`): `"Good trade" | "Emotional error" | "Technical error" | "Missed trade"`. This is *execution quality*, separate from `outcome` (`Win/Loss/BE`, the actual P&L).
- **"Missed trade" is hypothetical** — a setup seen but never taken, logged with a hypothetical `resultaat_pct`. It must never dilute real performance numbers (resultaat, win-rate, streaks, drawdown, review stats, equity curves, ...). Every view enforces this through the shared helpers in `src/lib/stats/core.ts` — `isMissed()`, `takenTrades()`, `missedTrades()` — rather than re-filtering locally. When adding any new stat, route it through these, don't hand-roll a filter.
- Not selectable within a backtest project — `ResultSection.tsx` hides the "Trade evaluation" field entirely there (gated on the `allowMissedTrade` flag), since it isn't meaningful outside the live Journal.
- `round2()` in `core.ts` normalizes `-0` to `0` — needed because `Math.round` on an exact-zero negative sum can yield `-0`, which breaks both `toEqual` in tests and risks rendering "-0%" in the UI.
- **Fase is een gewoon config-veld sinds de retirement (0059).** `profiles.hide_fase`, `hideFase` (useAuth) en `isLegacyMethodology` bestaan niet meer. Het WPM-journal draagt een `fase`-enum-veld in `methodology_fields` (opties Fase 1-4) net als elk ander custom-veld; loggen/filteren loopt via het generieke config-pad. Er is geen aparte fase-kolom en geen fase-toggle meer. **Wél behouden (owner-feedback 2026-09-18):** (1) de per-fase-analyselaag — de 4 fase-kaarten + "Resultaat per Fase"-bar bovenaan `BacktestingAnalysisView` (Journal én Backtesting), gegate op `fields.some(f => f.field_key === "fase")` en lezend uit `custom.fase` (volgorde = veld-opties); fase krijgt dan géén losse breakdown-tabel maar blijft kruistabel-as `custom:fase`. (2) config-velden staan **verweven vlak na Entry** in het trade-formulier, per groep-subkopje (Setup/Markt/Mindset via `WOVEN_GROUP_KEYS`) i.p.v. één "extra velden"-dump onderaan — `CustomFieldGroup` rendert de gegroepeerde velden, `CustomFieldsManager` (onderaan) draagt de ongegroepeerde/eigen velden + de veld-beheer/toevoeg-UI, `CustomFieldVisibilitySync` doet de `show_when`-clearing. Nieuwe WPM-journals ontstaan uit de `wpm`-strategie-startset (`fieldBlocks.ts`).
- `custom_options` table (`user_id`, `field`, `value`) — historische per-user extra waarden voor `entry`/`trade_concept`. Sinds 0059 zijn `entry`/`trade_concept` gewone config-enum-velden in `methodology_fields`; migratie 0059 heeft elke `custom_options`-waarde in de veld-opties gemerged. De tabel + `useCustomOptions`-hook blijven bestaan (nog niet gedropt) maar zijn **niet meer in het trade-formulier bedraad** — opties bewerken gaat nu via de veld-editor (MethodologyEditor). Drop van de tabel = een latere migratie zodra niets 'm meer leest.

## Architecture conventions

- `src/lib/stats/` — all calculation logic (streaks, drawdown, expectancy, per-dimension breakdowns) lives here as pure functions. Views read from this, nothing gets recomputed inline. `computeOverviewKpis()` in `core.ts` is the single entry point for the Overview KPI row.
- `TradesApi` (from `useTrades`) is owned by the page and passed down as a single shared instance — don't create a second instance for a subtree, that would desync trade state.
- Streak rule: BE pauses a streak (no reset, no increment), only Win/Loss break it.
- Drawdown/equity curve: chronological by `datum_open`, tie-broken by `id`, via `sortChronological()`.
- Fase-specific fields (`FASE_KENMERKEN` in `constants.ts`) are config-driven so the Backtesting breakdown UI renders every fase-kenmerk via one `.map()` instead of hand-written blocks per fase.
- **UI-bouwstenen: eerst zoeken in `src/components/ui/`** (Card, Modal, BooleanToggle, AddableSelect, EmptyHint, Logo, ThemeToggle, ...) vóór je iets nieuws bouwt; een nieuwe gedeelde bouwsteen hoort dáár, niet als lokaal one-off component in een feature-map. `EmptyHint` (blok E) is de gedeelde lege-staat: uitleg-zin + link naar de Gids (`/help`).
- **Locale-volgende getallen:** `numberLocale()` in `src/lib/format.ts` (leest `<html lang>`, dat de i18n-bootstrap synct; fallback NL) is de bron voor duizendtal/decimaal-groepering. `formatEUR`/`formatAggregate` volgen 'm automatisch; een los `.toLocaleString()` hoort `numberLocale(i18n.language)` te krijgen i.p.v. hardcoded `"nl-BE"`. Datums lopen via `dateLocale(lang)`.
- **Vaste trade-enums vertalen via het `enums`-i18n-namespace** (blok E): `getLabel={(o) => t(\`enums.<kind>.${o}\`, o)}` op `EnumSelect`; de opgeslagen waarde blijft de rauwe enum-string. Win/Loss/BE en Long/Short zijn bewust identiek in beide talen (trading-loanwords, in sync met OutcomePill/lijst-badges) — alleen de trade-evaluation-zinnen verschillen.

## Auth / multi-tenant status

Multi-tenant signup is **built**, not hypothetical: `profiles` table + auto-provisioning trigger (`supabase/schema.sql`), `/signup`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy` all exist and are routed (`src/router.tsx`), `useAuth.tsx` has `signUp`/`sendPasswordReset`/`updatePassword`. RLS is scoped per-user (`user_id = auth.uid()`) on every table.

**Public registration is currently gated off** — `supabase.auth.signUp` will error until the owner completes the rollout steps in README.md §5 (Turnstile site, Supabase CAPTCHA protection, URL config, "Allow new users to sign up" toggle). Until then, new accounts are created manually via the Supabase dashboard.

**Turnstile/CAPTCHA is temporarily fully disabled** (both `VITE_TURNSTILE_SITE_KEY` on Vercel and Supabase's CAPTCHA protection toggle) to allow the owner's real Chrome *and* this session's sandboxed Browser pane to load the app during active development — the widget previously crashed the Browser pane. `CaptchaWidget.tsx` already renders `null` with no site key, so this needed no code change. **Before public launch this must be re-enabled** (see README.md §5) — at that point, opening the production URL in the Browser pane needs re-confirmation with the user first (Turnstile is suspected incompatible with it).

Terms/Privacy pages carry full drafted copy but are **not yet legally reviewed** — flag this if asked about launch readiness (a legal review is a launch-week task, blocking before Stripe/paid but not before the free beta).

## Feature-gating status (bijgewerkt 2026-09-09, fixplan blok A)

- Per-user configurable trading methodology is **built** (Scope C): journals = user-owned `methodologies` rows with `methodology_fields`, per-journal isolation of trades/reviews/accounts, presets, custom fields in `trades.custom`.
- **Live voor iedereen (un-gated bij de beta-launch):** de volledige journal-config UI — journal-switcher (Sidebar), Settings-journalsectie (JournalOverview, NewJournalCard/preset-picker, veld-editor, review-sections-editor, advanced-analysis, journal-instruments) — plus de onboarding-wizard (eerste run, `onboarded_at`), de Gids (`/help`), de preset-picker empty-state in het Journal, de analyse-laag (R-distribution, kruistabel, session/hour), Richting, `tijd_open`, resultaat-eenheid %/R/geld, data-export (CSV), Habits (`/habits`, per-user configureerbaar, 0056) en Dagboek (`/daily`, 0055).
- **Nog beta-gated (`useAuth().betaFeatures` = flag OR admin, 0033; de owner-email-hardcode is verwijderd in fixplan C6):** CSV/broker-import, share-links (trades + reviews), screenshots-upload (anderen krijgen het URL-veld). Un-gaten hiervan = fixplan blok H, ná validatie met echte gebruikers. (De Trade Contract-feature — `/contract`, owner-only — is 2026-09-15 volledig uit de app verwijderd; de `trade_contracts`-tabel staat nog in de DB tot een aparte drop-migratie.)
- **Gating-regel voor nieuw werk:** elke nieuwe feature start achter `betaFeatures` (maar zie de feature-freeze hierboven — er komt nu geen nieuw werk).
- ~~The legacy WPM fields stay hardcoded columns until cyclus 10~~ **AF (2026-09-18, migratie 0059):** de WPM-velden zijn config-velden in `trades.custom`, `isLockedLegacyField` en de fase-enumkolom bestaan niet meer. Zie de retirement-bullet in "Current plan".
- Habits/Dagboek zijn een aparte performance-laag naast het journal (nav-groep "Performance"): global per-user (niet journal-gebonden), tabellen `habits`/`habit_days`/`daily_journal_entries` (migraties 0054–0056). **Bevroren** — zie feature-freeze. (Trade Contract hoorde hier ook bij maar is 2026-09-15 verwijderd.)
- De landing-page (B5, `LandingPage.tsx` + `landing.css`) is gemerged en live op `/` voor uitgelogde bezoekers (ingelogd → redirect `/journal`); aankondiging/kanalen = launch-week (fixplan blok G).

## Deliberately out of scope for now (don't build unprompted)
- Stripe/billing — `profiles.plan` defaults to `'free'` as the only hook for this later.
- Migration from the old Google Sheets workflow, discipline/execution tracking, live broker integration. See spec §7-8. (MAE/MFE tracking is now **built** — the advanced-analysis layer, `methodologies.track_exit` per-journal opt-in, 0049/0050 — no longer out of scope.)

## Workflow preferences

- Only commit/push when the user explicitly asks — even mid-feature-work, don't assume approval carries forward.
- Prefer `git revert` over `git reset --hard` on shared branches; never force-push to `main`.
- **Directe pushes naar `main` kunnen niet meer** (branch protection sinds 2026-09-17: required status check "ci"): elke main-merge gaat via een PR waarvan CI groen is. `git push origin <branch>:main` is dood; de deploy-stap = branch pushen → PR (owner klikt, `gh` is niet geïnstalleerd) → CI groen → owner merget.
- Before any risky/destructive git operation, create and push a backup branch first if there's any chance of losing work.
- Run `npm run lint` (`tsc --noEmit`), `npm run test`, and `npm run build` clean before considering a change done.
