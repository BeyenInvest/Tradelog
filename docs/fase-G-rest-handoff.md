# Fase G-rest → beta-launch — handoff voor een nieuwe chat (2026-08-22)

> **Leidend plan:** `docs/masterplan-2026-08.md` (volgorde Q→R→G-rest→S1→I→N-rest→🚀BETA→S2→O→P).
> Fase Q + R zijn AF op main/prod (`0bd0cb3`, migraties t/m 0046 gedraaid). Dit doc dekt wat er ná R nog moet richting beta.
>
> **BETA-LAUNCH-SCOPE (owner-besluit 2026-08-22):** de beta gaat pas live als **G-rest + S1 + I (import-praktijktest) + N-rest** af zijn — realistisch **3–4 weken**. **O** (Stripe/monetisatie) en **S2** + **P** (schaal) blijven bewust ná de beta.
>
> **MODEL — VERPLICHT checken bij sessie-start** (staat in je system prompt). Draai je niet op het voorgeschreven model voor het item dat je oppakt: **niet bouwen**, meld het de owner. Vuistregel: **stats-motor / migraties / security/RLS / destructief → Fable; UI / views / content / polish → Opus.**

## Waar we staan (2026-08-22)

**In uitvoering: preset/onboarding-herontwerp** (masterplan G-rest item 1, deelstuk). Zie geheugen `beyen_preset_onboarding_redesign.md` + mockup-artifact `https://claude.ai/code/artifact/3c8c268f-2c2b-4096-94ad-4c28c2c9084a`.

- **Branch `fase-g-preset-builder`** (vanaf main `0bd0cb3`). **NIET gecommit/gepusht** — wijzigingen staan in de working tree.
- Gebouwd (Opus) + **groen** (tsc, 314 tests, build, dev-server clean), **layout door owner goedgekeurd**:
  - `src/lib/fieldBlocks.ts` — 20 bouwstenen + 10 startsets (asset×stijl) + `assetInstrumentConfig`.
  - `src/hooks/useJournalBuilder.ts` — commit → batch-insert velden (`reuseActiveIfEmpty` voor onboarding/empty-state; nieuw journal in Settings).
  - `src/components/settings/JournalBuilder.tsx` — het versmolten éénscherm + `NewJournalCard`-wrapper.
  - i18n `blocks` / `startsets` / `builder` in nl+en; test `src/lib/__tests__/fieldBlocks.test.ts`.
  - Vervangt `PresetChooser` in OnboardingWizard, JournalEmptyState, SettingsPage; **`PresetPicker.tsx` + `usePresets.ts` verwijderd** (git rm). Oude DB-seed-presets 0027/0028 nu ongebruikt door de app (nog niet gedropt).
- **Backup vóór start:** git-branch `origin/backup/pre-fase-g-20260822` @`0bd0cb3` + archief `Documents/Tradelog-backups/tradelog-full-2026-08-22.tar.gz`.
- **Eerste actie nieuwe chat:** de branch committen (owner-verzoek nodig) zodat de handoff robuust is — nu leeft het werk alleen in de working tree.

## Wat moet er nog gebeuren — per item + model

### A. Preset-builder afronden
| # | Item | Model | Migratie? | Notitie |
|---|---|---|---|---|
| A1 | **Branch committen** (`fase-g-preset-builder`) | git (elk) | nee | Owner moet 't vragen; daarna evt. mergen naar main bij launch. |
| A2 | ✅ **Opties reviseren + finetunen** (2026-08-25, commit `330699b`, prod-live) | **Opus** | nee | Content-pass in `fieldBlocks.ts` + locales. `direction_note`-blok weg (dupliceerde native `trades.direction`); orphan-blokken `followed_plan`/`liquidity_target`/`displacement` geactiveerd in startsets/ICT; enum-opties opgepoetst (quality A+/A/B/C, timeframe +30m/+1W, catalyst Breakout→Guidance, emotion +Overmoed/+Verveling, mistake → zuivere uitvoeringsfouten). Alleen nieuwe journals geraakt. |
| A3 | ✅ **Echte label-vertaalbaarheid** (2026-08-23, uncommit op branch) | **Fable** | **ja (0047)** | `label_key` + `group_key` op `methodology_fields`; render-time `fieldLabel()`/`fieldGroupLabel()` (fieldBlocks.ts) op álle renderplekken incl. share-view/admin; DB-trigger wist de key bij hernoemen (vrije tekst wint); backfill voor oude preset-forks; fork_methodology + shared_methodology_fields kopiëren/exposen de keys mee. 0047 GEDRAAID op prod + read-only geverifieerd (2026-08-24: kolommen+trigger aanwezig, 141/206 velden label_key, 147 group_key, restant = legacy-WPM/niet-catalogus zoals bedoeld, functies bijgewerkt). |
| A4 | ✅ **Gegroepeerd overzicht** (mockup-scherm 02) als "wissel journal"-view (2026-08-25, commit `83e4914`, prod-live) | **Opus** | nee | `JournalOverview` in Settings: eigen journals per asset-class, N velden · N trades, klik=wisselen, inline hernoemen. Alleen bij ≥2 journals; delete blijft in de sidebar-switcher. Visuele multi-journal-check nog door owner. |

### B. Rest van G-rest (masterplan §"Fase G-rest")
| # | Item | Model | Notitie |
|---|---|---|---|
| B1 | ✅ **Beta-flip — selectief un-gaten** (2026-08-23, uncommit op branch) | **Opus** | Un-gegate: onboarding, builder/preset-picker, journal-switcher, neutrale reviews (incl. PDF + share, gate helemaal verwijderd), instrument-curatie/methodiek-sectie, richting-veld + -filter, profit-factor (+KPI-grid altijd 3-koloms), result-unit, quick-log, PWA/service-worker, **regel-adherentie (N2)** + **current-streak-subregel** (owner-besluit 2026-08-23: óók un-gaten). **Gated gebleven** (`useAuth.betaFeatures`): import, screenshot-upload, share-knop. ⚠️ PWA-SW registreert nu voor iedereen (origin-wide, persistent) — check bij launch. |
| B2 | ✅ **Support-/contactlink** (2026-08-23) | **Opus** | `SUPPORT_EMAIL = "info@beyen.app"` in `constants.ts`; support-kaart in Settings → sectie "Account" (mailto + adres als tekst). Terms/Privacy-placeholders nog NIET ingevuld (= B4, owner). |
| B3 | ✅ **Account-verwijder-entry-point** in Settings (2026-08-23) | **Opus** | `DeleteAccountSettings`-kaart in Settings → "Account"-sectie roept `useAuth.deleteAccount()` (RPC 0006) via `DeleteAccountModal` aan. |
| B4 | ✅ **Terms/Privacy** volledig uitgeschreven (2026-08-25, commit `a44588d`, prod-live) | **Opus** | Volledige NL-teksten op de echte datastroom (Supabase/Vercel/Cloudflare/Sentry, RLS, self-service verwijdering, deel-links, geen-advies-disclaimer). Contact info@beyen.app ingevuld, entiteit = natuurlijke persoon BE. **Niet juridisch nagekeken** — review aanbevolen vóór de betaalde launch (Stripe); tekst zegt zelf dat 't bij bedrijfsregistratie/betaling wordt bijgewerkt. EN-vertaling optioneel later. |
| B5 | **Landing page** op `/` (goedgekeurde mockup → React) | **Opus** | **Geblokkeerd op designer-logo** + PWA-iconen. Positionering t.o.v. concurrent Create Impacts meenemen (masterplan §Concurrentie-besluiten): volwaardig journal gratis, meerdere journals, %/R/$-weergave, screenshot-upload, open trades. |
| B6 | **Launch-week ops**: Turnstile → Supabase URL-config → e-mailtemplates + custom SMTP → Sentry-DSN + uptime + DB-backup → signup-toggle aan → smoke-test | **owner-ops** | Ná Turnstile: geen Browser-pane meer op prod zonder overleg. |

### C. S1 — trader-polish vóór launch (masterplan §S1, core.ts-motor zit al in R)
| Item | Model |
|---|---|
| Kalender week/maand-totalen + dag-KPI-kop; quick-log pro (risk/opslaan-&-volgende/notitie/datum); invoerfrictie (outcome uit teken, laatst-instrument, sanity-waarschuwing); KPI-cards (grootste win/verlies, gem. risico, SQN/std-dev, DD-markers); journal-bewuste tradelijst-kolommen | **Opus** |

### D. ✅ I — import-praktijktest (AF, vastgesteld 2026-08-24)
Was al gebeurd op 2026-08-18 (deze sectie liep achter): MT4-parser gevalideerd op **echte FTMO-statement** van de owner (2 bugs gefixt, 27 trades correct, regressietest-fixture) én echt in de app geïmporteerd (aparte journal "FTMO $100k", -6,13% match). Alles gemerged naar main/prod (`1c34877`, incl. het weekly-review-pdf-restje); cTrader/TV gehard tegen gedocumenteerde formaten (`be2b02b`). N9 (datumformaat-keuze) zat in R sessie 1. **MetaTrader is de enige echte importbron van de owner** (hij backtest handmatig in TradingView, exporteert daar niets) — TV/cTrader-parsers blijven zonder owner-validatiepad, bewust. Geparkeerde punten: A moot (aparte journal), C moot (swing); **alleen B rest** (fictieve R bij `risk_pct=null` via 1%-fallback ongemarkeerd in UI) → klein, meenemen in N3 (zelfde stats-hoek, Fable). Zie geheugen `beyen_fase_i_import.md`.

### E. N-rest (IN beta-scope)
- **N1** meer presets (ICT/SMC, breakout, mean-reversion, opties-wheel) — **Opus** (past nu in de nieuwe bouwsteen/startset-structuur i.p.v. DB-seeds).
- ✅ **N3** MAE/MFE (2026-08-24, Fable) — **migratie 0049** (`mae_pct`/`mfe_pct` als positieve magnitudes in %, `planned_rr` als R:R-multiple; open-trade-check `trades_open_no_excursion_chk`, planned_rr mag wél open). Stats in `src/lib/stats/exit.ts` (`computeExitStats`: stop-analyse/heat, exit-efficiëntie/capture-ratio, plan-vs-realisatie), zelfde caller-contract als core (missed via `takenTrades`, open via `closedTrades` eruit). UI: exit-veldenblok in ResultSection (form, **beta-gated**) + `ExitAnalysisSection` in de Analyse-tab (**beta-gated**, ook backtest-projecten; verdwijnt zonder data). Geparkeerd punt B zit erin: `hasExplicitRisk()`/`RStats.assumedRiskN` → "~"-prefix + tooltip op elke R-weergave die (deels) op het aangenomen 1%-default-risico rust (tradelijst, groepstotalen, KPI-cards, admin) — die markering is bewust NIET beta-gated (correctheids-fix op bestaande R-weergave). Import laat de velden bewust leeg (MT4 — de enige gevalideerde bron — levert geen excursies); CSV-mapping is toekomstwerk zodra een bron ze echt aanlevert. shared_trade_json (share-RPC-allow-list) bewust niet uitgebreid: share-views renderen geen exit-analyse.
- ✅ **N5** review-secties configureerbaar per journal — **Opus** (branch `fase-n5-review-secties`, 6 deelstuk-commits, lint/test/build groen). Volledige sectie-builder gespiegeld op `methodology_fields`: nieuwe tabel `review_sections` + `content` jsonb-bag op weekly/periodic_reviews, resolver `src/lib/reviewSections.ts` (defaults reproduceren pre-N5 exact), editor in Settings (weekly/periodic-toggle, hernoemen/herordenen/toevoegen/verwijderen/reset), threading door formulier + weergave + PDF + publieke share (`get_shared_review`) + admin. **Migratie 0048** gedraaid op prod; get_shared_review is een SECURITY DEFINER-RPC-edit (mirror van 0042) die Fable desgewenst kan nachecken. **Beta-gated** (owner-besluit 2026-08-24): de ReviewSectionsEditor in Settings staat achter `useAuth().betaFeatures`, dus niet-beta-gebruikers kunnen geen eigen secties maken → zien altijd de defaults (identiek aan vóór N5). Gemerged naar main (`f9c6766`) + gepusht.

### F. Ná de beta (bewust uitgesteld)
- **Weekly digest e-mail** — éérste item ná de beta-launch (owner-besluit 2026-08-24 n.a.v. concurrentie-audit Create Impacts, zie masterplan §Concurrentie-besluiten): wekelijkse stats + focuspunten per mail; Supabase cron/edge + mailprovider. **Fable** (infra) + Opus (inhoud).
- **Post-launch-register uit dezelfde audit** (S2/O-tijdvak): discipline-pack als preset-veld-pack, trade-plan-koppeling, AI-laag (plan-PDF-extractie → plan-compliance), share-cards. Beta-scope zelf ongewijzigd.
- **S2** verdieping (Fable: datetime-migratie/sessie-dimensie, prop v2, multi-select, offline-queue · Opus: histogram/kruistabel-views, underwater-chart, dag-laag, projectvergelijking, CSV-export, share-scope, missed-kaart).
- **O** monetisatie (Opus), **P** opruiming/schaal (Fable; cyclus 10 WPM-kolommen droppen, server-aggregatie).

## Aanbevolen volgorde voor de nieuwe chat(s)
1. **Opus** — A1 committen → B2 support-link + B3 account-delete (klein, decision-licht) → B1 beta-flip (selectief). Dit maakt G-rest code-klaar.
2. **Fable** — A3 label_key-migratie (0047) — parallel of erna.
3. **Opus** — S1 trader-polish; **N1** presets; **N5** review-secties.
4. **Fable** — **I** import-praktijktest → daarna **N3** MAE/MFE.
5. **owner** — B4 Terms/Privacy, B6 launch-week; B5 landing zodra logo er is.
6. 🚀 **beta-launch** zodra bovenstaande af is (~3–4 weken).

Migratienummer eerstvolgend vrij: **0047** (A3 claimt 'm als eerste).
