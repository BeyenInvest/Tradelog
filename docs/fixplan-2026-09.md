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
| B | Vangrails (CI + backups + alerting) | **Fable** + owner | 1 dag | ☐ |
| C | Schema-sync + registry (migratie 0057) | **Fable** | 1 sessie | ☐ |
| D | Zichtbare motor-poets | **Fable** | ½ dag | ☐ |
| E | UX / a11y / i18n / merk-poets | **Opus** | 1 dag | ☐ |
| F | Stabiliteit vóór gebruikers | **Fable** | 1 dag | ☐ |
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

- [ ] B1. **CI** (Fable, ~30 min): `.github/workflows/ci.yml` — `npm ci` → lint → test → build op elke push + PR naar main. Daarna op GitHub als required check op main zetten (owner-klik).
- [ ] B2. **Backups** (owner-besluit): Supabase **Pro ($25/mnd, 7 dagen backups)** — aanbevolen zodra er ook maar één beta-gebruiker echte data heeft — óf een dagelijkse `pg_dump`-cron via de bestaande `SUPABASE_DB_URL`. Fable levert desgewenst het pg_dump-script.
- [ ] B3. **Restore één keer oefenen** (owner + Fable read-only begeleiding): dump terugzetten naar een gratis wegwerp-Supabase-project en verifiëren dat de app ertegen start. Dít is het bewijs dat B2 echt werkt.
- [ ] B4. **Uptime-ping** (owner, 10 min): gratis monitor (bijv. UptimeRobot) op https://beyen.app + e-mail-alert.
- [ ] B5. **Owner-dashboard-checklist** (uit audit Laag 7, ~15 min): Supabase-tier & backup-status · zijn 0053–0056 echt op prod gedraaid · Auth-wachtwoordminimum ≥8 + leaked-password-protection aan · projectregio = EU · `VITE_SENTRY_DSN` op Vercel gezet en komen events binnen · SMTP/e-mailtemplates klaar · DPA's Supabase/Vercel/Sentry/Cloudflare afgevinkt en bewaard. Uitkomsten terugmelden in de sessie → dit doc bijwerken.
- [ ] B6. Sentry-sourcemaps (`@sentry/vite-plugin`) — mag ook in blok F, maar hoort vóór de eerste echte gebruikersfout.

## Blok C — Schema-sync + registry · **Fable** · 1 sessie · migratie **0057** 🔴

Doel: de DB-waarheid verankerd. Werklijst = `docs/schema-sync-werklijst-2026-09.md`, plus wat er sinds 03-09 bij kwam. Owner draait de migratie zelf (runner-werkwijze), sessie verifieert read-only.

- [ ] C1. schema.sql volledig syncen t/m **0056**: FK-volgorde-fix (methodologies vóór r81/110/245), `periodic_reviews.periode_overzicht`, share-laag (share_links + 5 RPC's), `create_journal`, `rename_field_option`, screenshots-bucket + policies, 0047-seeds-backfill, composiet-index, 0036-conventie — én **habits, habit_days, daily_journal_entries** (0054–0056, ontbreken ook).
- [ ] C2. Migratie 0057: `fork_methodology` kopieert `track_exit` (0048-body als vertrekpunt, 0052-conventie) + `review_sections.updated_at`-trigger (staat ook op prod eeuwig op insert-waarde).
- [ ] C3. **`schema_migrations`-registry**: tabel + `run-migration.mjs` registreert elke gedraaide file en weigert dubbele runs; 0020-duplicaat documenteren. Backfill-insert voor 0001–0057 meeleveren.
- [ ] C4. Runner-TLS: Supabase-CA meegeven + `rejectUnauthorized: true` (M2).
- [ ] C5. `fetchCounts` hard laten falen bij count-error (C-R2-4, `useJournals.ts:130-144`) — voorkomt orphaned trades bij journal-delete.
- [ ] C6. **Owner-e-mail uit de bundle** (`useAuth.tsx:64`): owner draait `update profiles set beta_features = true where ...` (copy-paste-klaar aanleveren), daarna `OWNER_BETA_EMAILS` verwijderen.
- [ ] C7. Verse-bootstrap-test: schema.sql tegen een wegwerp-project draaien (combineert mooi met B3).

## Blok D — Zichtbare motor-poets · **Fable** · ½ dag 🔴-randje

Doel: de 7 openstaande motorpunten (na twee audits 0/7) — waarvan één voor gebruikers zichtbaar is.

- [ ] D1. Kalendertotalen: maand/week sommeren over rauwe waarden i.p.v. gerondde dagtotalen (`calendarTotals.ts:75-80,87`) — dicht de zichtbare 0,99R-vs-1,0R-drift. + consistentietest kalender ≡ KPI.
- [ ] D2. Kruistabel: `d.id !== autoRowDim?.id` in de timing-tak (`CrossTable.tsx:67`) — één regel (N-R2-1, MIDDEL).
- [ ] D3. PDF-equity-curve: duplicaat in `reviewPdfData.ts:191-197` vervangen door `computeEquityCurve(taken)`.
- [ ] D4. Eén round-half-away-from-zero-helper: dekt `round2` (`core.ts:567`) én R-histogram (`breakdown.ts:189`).
- [ ] D5. `computeProfitFactor` op rauwe sommen delen (`core.ts:276-279`).
- [ ] D6. `computeDurationByOutcome` → `ClosedTrade[]`-signature + missed-guard-test (`duration.ts:9`).
- [ ] D7. Klein: comment bij `CROSS_SEP = "\0"` (breakdown.ts:229); `propFirm.ts:68` NaN-guard bij target 0; M8-commentaar `types.ts:11-16` corrigeren.

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

- [ ] F1. **PWA-reload-guard** (C-R2-1): reload uitstellen zolang een dirty modal openstaat, óf prompt-mode met verversen-toast (`vite.config.ts:17` + `RegisterSW.tsx`) — "deploy om 21:30 wist een halfgeschreven review" mag nooit gebeuren.
- [ ] F2. **Visibility/focus-refetch** van profiel + trades (C-R2-2 + C3; dekt ook stale switcher-counts en de token-refresh-remount C-R2-3) + 0-rows in `updateTrade` mappen naar "deze trade bestaat niet meer".
- [ ] F3. E1-kalender-guard: `Array.isArray` op de feed (`useEconomicCalendar.ts:17`) — 1 regel, voorkomt hele-pagina-crash.
- [ ] F4. Quick-log: verplichte custom velden tonen of hint (Q1, `QuickLogForm.tsx:115`).
- [ ] F5. Prop-accounts: één-actief-invariant of bron-badge (PA1) + inline-edit voor naam/size/fase (PA2, mag naar H).
- [ ] F6. `npm audit fix` (fast-uri) + `npm uninstall date-fns` + dode exports constants.ts + api-tsconfig (M1) — de hygiëne-restjes in één veeg.

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
