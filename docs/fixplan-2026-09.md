# Fixplan — 2026-09 (n.a.v. meta-audit-2026-09.md)

**Besluit owner 2026-09-09: totale feature-freeze tot na de beta-launch.** Geen nieuwe features, geen nieuwe migraties behalve wat hieronder staat. Dit plan dekt álle punten uit `docs/meta-audit-2026-09.md` en vervangt de open delen van masterplan-launch.md.

**Bindende spelregels (gelden voor élke sessie hieronder):**
- Eén sessie = één branch = één blok hieronder. "Klaar" = **gemerged op main + docs/CLAUDE.md bijgewerkt + dit plan afgevinkt** — niet "code groen op een branch".
- Max **1 open werkstroom tegelijk**. Niet aan blok N+1 beginnen vóór blok N op main staat.
- Elke sessie draait `npm run lint` + `npm run test` + `npm run build` groen vóór merge (vanaf blok B dwingt CI dit af).
- Model-per-fase-regel (bindend, zie memory): **Fable** = migraties/SQL/security/stats-motor/git-chirurgie · **Opus** = UI/copy/polish. Elke sessie checkt bij start zijn eigen model tegen dit plan.
- Migratienummers: eerstvolgende vrij = **0057**. Nummers nooit hergebruiken; elke migratie werkt schema.sql mee bij (conventie is na 0053 gaan slippen — vanaf nu weer hard).

Ernst-legenda: 🔴 vóór beta · 🟠 vóór betaald/schaal · 🟡 poets.

---

## Overzicht & volgorde

| Blok | Naam | Model | Effort | Status |
|---|---|---|---|---|
| A | De grote schoonmaak (integratie) | **Fable** | 1 dag | ☑ 2026-09-09 |
| B | Vangrails (CI + backups + alerting) | **Fable** + owner | 1 dag | ◐ code ☑ 2026-09-10 · owner-stappen open (B2-B5 + required-check) |
| C | Schema-sync + registry (migratie 0057) | **Fable** | 1 sessie | ◐ code ☑ 2026-09-10 · owner: 0057 draaien + CA + beta-SQL (C7 met B3) |
| D | Zichtbare motor-poets | **Fable** | ½ dag | ☑ 2026-09-10 |
| E | UX / a11y / i18n / merk-poets | **Opus** | 1 dag | ☐ (bewust overgeslagen door Fable-sessie — model-regel) |
| F | Stabiliteit vóór gebruikers | **Fable** | 1 dag | ☑ 2026-09-10 (PA2 → H; vitest-advisory → H) |
| G | Launch-week (B6) | owner + **Opus** | 2–3 dagen owner-werk | ☐ |
| H | Post-launch (pas ná 2–4 weken echte gebruikers) | per item | — | ☐ |

A → B → C mogen niet wisselen van volgorde. D/E/F mogen onderling schuiven maar komen ná C en vóór G.

---

## Blok A — De grote schoonmaak · **Fable** · 1 dag 🔴

Doel: er bestaat weer precies één werkelijkheid (main = prod = docs). Fable vanwege git-chirurgie + gating-logica.

- [x] A1. Backup-branch pushen vóór alles — gedaan: `backup/pre-fixplan-20260909-ungate` + `backup/pre-fixplan-20260909-main` op origin.
- [x] A2. `fase-onboarding-ungate` gerebased op `origin/main` — WIP eerst gecommit; enige echte conflict was de Sidebar-importregel (nav-hergroepering behouden, HelpCircle toegevoegd); locales/router auto-gemerged.
- [x] A3. Un-gate-gaten gedicht (optie 1): Settings-journalsectie + journal-switcher live voor iedereen; `TradeJournalView` ongemoeid. CSV-import, share-links, screenshots-upload blijven beta-gated (blok H).
- [x] A4. `fase-b5-landing` (db7ef42, lokaal 1 voor op origin) gemerged. Landing staat daarmee live op `/` voor uitgelogde bezoekers — vergt geen aparte config; aankondiging blijft blok G.
- [x] A5. Branch-hygiëne, uitgevoerd 2026-09-09:
  - `weekly-review-pdf-polish` bleek de meest complete import-branch (bevatte héél `fase-i-import` + `fase-2-scale-import` + MT4/cTrader/TV-parserwerk + 1 weekly-PDF-restyle-commit 7360fe4) → hernoemd geparkeerd als **`parked/fase-i-import-v2`** (gepusht). Ontparkeren bij blok H (eerste echte CSV-import); de PDF-restyle-commit erin valt onder de Review-PDF-freeze.
  - `fase-i-import` + `fase-2-scale-import` (lokaal) en oude backups (`backup/fase-2-pre-sync-20260808`, `backup/fase-b5-landing-v1/-v2`) verwijderd — alle inhoud aantoonbaar bevat in `parked/fase-i-import-v2` resp. de gemergde `fase-b5-landing`.
  - Nog door owner (classifier blokkeerde destructieve remote-acties): `git push origin --delete weekly-review-pdf-polish fase-2-scale-import backup/fase-b5-landing-v1 backup/fase-b5-landing-v2` en `git stash drop stash@{0}` (orphan `epitaxy`).
- [x] A6. CLAUDE.md bijgewerkt (freeze-regel, "klaar = main + docs", UI-bouwstenen-regel, gating-status, Habits/Dagboek/Contract, landing); README §5 kreeg statusblok; masterplan-launch.md kop "VERVANGEN door fixplan-2026-09.md".
- [x] A7. Alles op lokale main (ff naar ec3eb07+) — lint/tsc + 420 tests + build groen; werkbranch als vangnet gepusht. Push naar origin/main door owner (classifier blokkeerde `git push origin main`); Vercel-deploy daarna als Ready verifiëren.

## Blok B — Vangrails · **Fable** (CI) + **owner** (dashboards) · 1 dag 🔴

Doel: de blinde vlek dicht — nooit meer onherstelbaar, nooit meer onzichtbaar.

- [x] B1. **CI** — `.github/workflows/ci.yml` staat er (npm ci → lint → test → build, push+PR naar main, Node 24). ☐ **Owner-klik open:** na de eerste groene run op GitHub als required check op main zetten (Settings → Branches → require status check "ci").
- [ ] B2. **Backups** (owner-besluit open: Pro vs cron). Het pg_dump-script is geleverd: `scripts/backup-db.mjs` (public+auth, -Fc, rotatie 14, faalt hard op lege dump; `backups/` in .gitignore). Vereist eenmalig PostgreSQL client-tools (`winget install PostgreSQL.PostgreSQL.17`). Aanbeveling blijft Supabase Pro zodra één echte beta-gebruiker data heeft.
- [ ] B3. **Restore één keer oefenen** (owner): stappen staan in de kop van `scripts/backup-db.mjs` (wegwerp-project + schema.sql + pg_restore --data-only). Combineert met C7.
- [ ] B4. **Uptime-ping** (owner, 10 min): gratis monitor (bijv. UptimeRobot) op https://beyen.app + e-mail-alert.
- [ ] B5. **Owner-dashboard-checklist** (uit audit Laag 7, ~15 min): Supabase-tier & backup-status · zijn 0053–0056 echt op prod gedraaid · Auth-wachtwoordminimum ≥8 + leaked-password-protection aan · projectregio = EU · `VITE_SENTRY_DSN` op Vercel gezet en komen events binnen · SMTP/e-mailtemplates klaar · DPA's Supabase/Vercel/Sentry/Cloudflare afgevinkt en bewaard. Uitkomsten terugmelden in de sessie → dit doc bijwerken.
- [x] B6. Sentry-sourcemaps: `@sentry/vite-plugin` in vite.config.ts, volledig inert zonder `SENTRY_AUTH_TOKEN` (lokaal/CI bouwen zonder secrets; sourcemap "hidden", maps na upload verwijderd). ☐ **Owner:** `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` als env-vars op Vercel zetten.

## Blok C — Schema-sync + registry · **Fable** · 1 sessie · migratie **0057** 🔴

Doel: de DB-waarheid verankerd. Werklijst = `docs/schema-sync-werklijst-2026-09.md`, plus wat er sinds 03-09 bij kwam. Owner draait de migratie zelf (runner-werkwijze), sessie verifieert read-only.

- [x] C1. schema.sql volledig gesynct t/m **0056** + 0057 (2026-09-09): W1-FK-volgorde gefixt (methodology_id als kale kolom in weekly/periodic/prop_accounts **én trade_contracts** — die had hetzelfde probleem — met named-FK-constraints ná het methodologies-blok, namen = prod-default), periode_overzicht, volledige share-laag (share_links 0042-eindstand + shared_trade_json 0052 + shared_methodology_fields 0047 + shared_review_sections 0048 + get_shared_journal 0043 + get_shared_review 0052, incl. bindende share-RPC-conventie als commentaar), create_journal + rename_field_option, screenshots-bucket + 4 policies, 0047-label-backfill na de seeds, composiet-index, 0036-conventie op alle 5 functies, link_trade_to_weekly_review 0052-versie, habits/habit_days/daily_journal_entries (0054–0056) incl. RLS + triggers, header + conventie. share_links-zonder-admin-policy als bewuste keuze gedocumenteerd.
- [x] C2. Migratie **0057** (`0057_registry_fork_track_exit.sql`) geschreven: fork_methodology + track_exit (0048-body als vertrekpunt), review_sections-updated_at-trigger, registry + backfill. ☐ **Owner draait 'm** (runner-werkwijze); daarna verifieer ik read-only.
- [x] C3. Registry: tabel in 0057 + backfill 0001–0057 (0020-duplicaat = 2 bestandsnamen = 2 rijen, gedocumenteerd in schema.sql-header); `run-migration.mjs` weigert al-geregistreerde files (FORCE_RERUN=1 als bewuste override) en registreert elke run in dezelfde transactie.
- [x] C4. Runner-TLS strict: verifieert tegen `supabase/prod-ca-2021.crt` (of env `SUPABASE_DB_CA`), weigert zonder CA (escape hatch `ALLOW_INSECURE_DB_TLS=1`). ☐ **Owner:** CA eenmalig downloaden — Dashboard → Project Settings → Database → SSL Certificate → opslaan als `supabase/prod-ca-2021.crt` (staat niet in git nodig; mag wel, het is een publiek certificaat).
- [x] C5. `fetchCounts` faalt nu hard op elke count-error (geen stille `?? 0` meer).
- [x] C6. `OWNER_BETA_EMAILS` uit `useAuth.tsx` verwijderd. ☐ **Owner draait éérst** (vóór of direct na de deploy): `update profiles set beta_features = true where email = 'superrrdun@gmail.com';`
- [ ] C7. Verse-bootstrap-test: schema.sql tegen een wegwerp-project draaien (owner, combineert met B3). NB: het storage-blok vereist een Supabase-omgeving (staat zo gemarkeerd in schema.sql).

## Blok D — Zichtbare motor-poets · **Fable** · ½ dag 🔴-randje

Doel: de 7 openstaande motorpunten (na twee audits 0/7) — waarvan één voor gebruikers zichtbaar is.

- [x] D1. Kalendertotalen: `rawDayTotalsInUnit` toegevoegd — week/maand sommeren over raw, dagcellen blijven round2 (CalendarView aangepast) + consistentietest kalender ≡ KPI (0.335×3-drift-case).
- [x] D2. Kruistabel: timing-tak sluit `autoRowDim` nu uit (CrossTable.tsx).
- [x] D3. PDF-equity-curve deelt `computeEquityCurve` (oude lokale kopie rondde de running sum per stap).
- [x] D4. `roundHalfAwayFromZero` in core.ts als dé afrondingsprimitief; `round2` en de R-histogram-bins gebruiken hem (−0.5R hoort in −1R, niet 0R).
- [x] D5. `computeProfitFactor` deelt op rauwe sommen; afronden alleen voor weergave.
- [x] D6. `computeDurationByOutcome` → `ClosedTrade[]` + missed-guard-test (422 tests totaal).
- [x] D7. CROSS_SEP-NUL-byte-comment, propFirm `> 0`-guards (NaN/Infinity bij 0-target), types.ts-fase-commentaar gecorrigeerd (kolom is wél nog een Postgres-enum).

## Blok E — UX / a11y / i18n / merk-poets · **Opus** · 1 dag 🔴 (E1–E3) + 🟡

- [ ] E1. **Field.tsx label-associatie** (htmlFor/id of wrap) — één component repareert vrijwel elk formulier voor screenreaders (X2).
- [ ] E2. **Discard-dialog binnen de focus-trap + autofocus** op de dialog (X1 — toetsenbordgebruiker kan "Niet opslaan" nu onmogelijk bereiken; Modal.tsx/TradeForm.tsx:308 + useModalGuard.tsx).
- [ ] E3. Enum-vertaling aan de invoerkant: `getLabel` voor OUTCOMES/TRADE_EVALUATIONS/DIRECTIONS in `EnumSelect`-call-sites (ResultSection.tsx:123,127; EntrySection.tsx:106) — weergavekant vertaalt al.
- [ ] E4. "Beyen Invest" → "Beyen" op `SharePageShell.tsx:29` en `ReviewPdfDocument.tsx:545` (klinkt als vermogensbeheerder, lekt op exact de publieke oppervlakken).
- [ ] E5. Lege staten Reviews/Accounts/Backtesting: één uitleg-zin + link naar de Gids (`/help`).
- [ ] E6. Icon-knoppen aria-labels (modal-sluitkruisjes TradeForm.tsx:277, QuickLogForm.tsx:146); `text-faint` → `--muted` voor informatieve tekst (AA-contrast).
- [ ] E7. i18n-klein: `formatEUR`/LotSize locale volgen i.p.v. hardcoded nl-BE (format.ts:7); economische-kalendertijden in profiel-timezone (EconomicEventRow.tsx:8).
- [ ] E8. Gids-link vanuit de onboarding-wizard (gemiste kans, nu alleen sidebar).

## Blok F — Stabiliteit vóór gebruikers · **Fable** · 1 dag 🔴 (F1–F2) + 🟠

- [x] F1. **PWA-reload-guard**: registerType → "prompt" + `dirtyFormRegistry` (useModalGuard meldt dirty formulieren aan; RegisterSW parkeert de update-reload tot het laatste dirty formulier sluit/opslaat — geen toast nodig, zonder dirty werk blijft het gedrag stil-en-vers zoals voorheen).
- [x] F2. **Visibility/focus-refetch**: nieuwe `useVisibilityRefetch`-hook (60s-throttle) op trades (useTrades.refresh, in-place) én profiel (useAuth.loadProfile, gesequenced); `updateTrade` mapt 0 rijen naar "Deze trade bestaat niet meer" (tradeForm.updateGone NL/EN) + verwijdert de rij lokaal.
- [x] F3. Kalender-guard: `Array.isArray` op de feed-JSON, anders nette foutmelding i.p.v. paginacrash.
- [x] F4. Quick-log toont een hint met de verplichte custom velden van het journal (fieldLabel-vertaald) — bewust hint, geen blokkade.
- [x] F5. Prop-accounts één-actief-invariant (PA1): actief-maken (create of toggle) deactiveert de andere actieve accounts van hetzelfde journal — de €-weergavebron is nu eenduidig. PA2 (inline-edit) → blok H.
- [x] F6. `npm audit fix` gedraaid: **fast-uri (high) gefixt**; date-fns verwijderd (0 imports); dode exports MONTH_NAMES + PERIOD_TYPE_LABELS weg (hardcoded NL/EN-strings die i18n omzeilden); `api/` in tsconfig-include (ff-calendar.ts draait nu mee in tsc). ⚠️ Restje: 2 moderate dev-only advisories in vitest/@vitest/mocker — fix = vitest 5-major-bump, bewust niet 's nachts gedaan; raakt alleen de dev-toolchain, niet de app. Meenemen bij de jsdom/hook-tests-post in blok H.

## Blok G — Launch-week (B6) · **owner** + **Opus** (copy/kleinwerk) · 2–3 dagen 🔴

Volgorde is hier kritiek (CAPTCHA vóór signup; meten vóór bezoekers).

- [ ] G1. **Jurist-uur**: naam + contactweg van de aanbieder in Terms §1 / Privacy §1 (nu anoniem = AVG art. 13 / WER-blokker); leespas over Terms+Privacy; korte bevestiging MiFID-inschatting ("geen advies"). Opus verwerkt de tekstwijzigingen.
- [ ] G2. Turnstile + Supabase-CAPTCHA weer aan (README §5). ⚠️ Memory: Browser-pane crashte eerder op Turnstile — na activatie prod niet meer in het Browser-paneel openen zonder eerst met owner af te stemmen.
- [ ] G3. Supabase URL-config + SMTP/e-mailtemplates → "Allow new users to sign up" aan → smoke-test met een echt vers account (signup → mail → wizard → journal bouwen → trade → stats), door owner op eigen apparaat.
- [ ] G4. Analytics (privacyvriendelijk, bijv. Plausible) + Privacy-policy-regel daarover mee laten lopen; Sentry-events verifiëren. Zonder meting is elke groeibeslissing blind.
- [ ] G5. Landing publiek + wachtlijst/e-mail-capture als fallback zolang iets nog dicht staat.
- [ ] G6. Kanaal-start (audit bril 17): NL/BE-communities (daytradingcommunity.nl, DeDaytrader, Trade & Connect, prop-Discords), build-in-public met eigen echte stats. Geen guru-partnerships.

## Blok H — Post-launch backlog (pas ná 2–4 weken echte gebruikers en data)

| Item | Model | Waarom wachten |
|---|---|---|
| CSV-import valideren met échte MT/TV-exports → un-gaten | **Fable** | Wachten op eerste echte CSV (memory: import-workflow geparkeerd); daarna = dealbreaker-fix voor power-traders |
| Prijs prikken (€9–15) + entitlement-check op `profiles.plan` + downgrade-ontwerp | **Fable** (enforcement) + owner | Eerst retentie zien; enforcement-laag mag eerder gebouwd maar ongebruikt |
| Pro verrijken (weekly digest; later AI over de gestructureerde velden) | **Opus** | Freeze; pas na launch — dít is de eerste toegestane "feature" |
| Share-links + screenshots un-gaten; maand-kaart met OG-image (growth-loop) | **Opus** | Na launch, als eerste growth-iteratie |
| jsdom-fix + 5–8 hook-tests (useTrades/useAuth) + 1 Playwright-smoke tegen seed-DB | **Fable** | Vangt de bewezen lekkende klassen (SQL/hook); CI bestaat dan al |
| Cyclus 10: legacy-WPM de-hardcoden (fase/entry/trade_concept) — raakt ±20% van src | **Fable** | Groot; vóór de volgende featuregolf, niet vóór launch |
| IconBtn + FIELD_TYPES dedup; datumformattering centraliseren; ESLint + react-hooks-plugin; `noUncheckedIndexedAccess` | **Opus**/Fable | Hygiëne, geen gebruikersimpact |
| Kolomselectie + parallelle paginatie in fetchAll (i.p.v. premature server-aggregatie) | **Fable** | Pas relevant richting 3–5k trades/journal |
| M/Q/Y-reviews samenvoegen tot één periodieke review; calendar+lot-size onder "Tools" | **Opus** | Nav-vereenvoudiging; met echte gebruikersdata beslissen |
| Share-tokens hashen; token-URL-restpunten documenteren | **Fable** | LAAG uit audit |
| Taalkeuze in profiel; EN-getalnotatie-review | **Opus** | Bij EN-push |

**Bevroren (geen commits, ook geen "kleine"):** Habits, Dagboek, Contract, Review-PDF (incl. polish-branch), MAE/MFE-laag, EN-copy-uitbreiding. Ontdooien = expliciete owner-beslissing in dit doc.

---

## Besluiten genomen bij opstellen (terugdraaien = hier noteren)

1. Un-gate-richting = **optie 1**: Settings-journalsectie + switcher live voor iedereen (i.p.v. copy afzwakken) — zet meteen de differentiator voor.
2. Habits/Dagboek blijven live (owner-besluit van 07-09) maar bevroren; Contract blijft owner-only.
3. Fase-2-server-aggregatie geschrapt van de roadmap ten gunste van kolomselectie + parallelle fetch (audit bril 7).

## Voortgang bijhouden

Elke afrondende sessie: vinkjes zetten in dít bestand + memory-entry bijwerken + CLAUDE.md actueel houden. Als een blok deels blijft liggen: niet half door naar het volgende blok — eerst afmaken of expliciet hier terugzetten.
