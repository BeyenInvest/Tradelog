# Fase R — startdoc (handoff van de Fase Q-sessie, 2026-08-21)

> **Leidend plan:** `docs/masterplan-2026-08.md` (volgorde Q→R→G→S1→LAUNCH→I→S2→N-rest→O→P). **Alle bevindingen in detail:** `docs/audit-en-launchplan-2026-08.md`. Dit doc is alleen wat je nodig hebt om Fase R te bouwen.
>
> **Model — VERPLICHT checken bij sessie-start** (staat in je system prompt):
> - **Sessie 1 = Fable** (rekenregels, guards, import-logica, RPC, stats-tests, core.ts-uitbreiding)
> - **Sessie 2 = Opus** (i18n-veegronde, ConfirmDialog, headers, WOFF2, SW-update, git-opruiming)
>
> Ben je het verkeerde model: niet bouwen, meld het de owner.

## Stand bij overdracht (2026-08-21)

- **Fase Q is AF**: commit `92369c5` op branch `fase-q-blockers`. Migratie **0044 is gedraaid op prod en geverifieerd** (kolom-grants K1, ownership-trigger N1, storage-delete N2 — incl. gesimuleerde user-tests in een teruggerolde transactie). Owner heeft de app-flows getest (trade-save, retry-scherm, review-relink, settings).
- **Eerstvolgend vrij migratienummer: 0045.**
- Branch is bij het schrijven nog niet gepusht/gemerged. **Fase R bouwt bovenop de Q-code** — start vanaf main als Q daar al in zit, anders vanaf `fase-q-blockers`. Eigen branch voor R (bv. `fase-r-correctheid`).
- Gedeelde-worktree-regels blijven gelden: nooit `git add -A`, alleen eigen bestanden stagen.
- Nieuw sinds de audit, relevant voor R: `src/lib/fetchAll.ts` (gepagineerde fetch-helper, H1) — hergebruiken waar een nieuwe fetch >1000 rijen kan raken; `useAuth` heeft nu `profileError`/`retryProfile` + een blocking `ProfileErrorScreen`.

## Sessie 1 — Fable (rekenregels, guards, import, RPC, tests)

*Rekenregels & datums:*
1. **M1** drawdown-baseline: `peak = 0` initialiseren in `core.ts` (r.~141-164) + test aanpassen — eerste losing streak wordt nu structureel onderschat.
2. **M2** `localTodayIso()`-helper: "vandaag" is nu UTC én in TradeForm bevroren op module-load (`TradeForm.tsx` r.~29 `EMPTY_DEFAULTS` → functie maken; ~6 andere plekken).
3. **N6** week-53-validatie (weekreview-formulier accepteert week 53 in jaren die er geen hebben).
4. **N5** prop-drawdown minimaal eerlijk labelen (géén echte trailing bouwen — dat is S2).

*Robuustheid:*
5. **M3+M7** request-guards (het `requestIdRef`-patroon uit `useTrades`) kopiëren naar `useMethodology`/`useAuth` e.a.; foutpad van `useMethodology.refresh` mag `fields` niet wissen (state behouden bij error).
6. **M8** ImportModal-dedup negeert fetch-fouten volledig → afhandelen.
7. **N9** import-datumformaat-keuze bij ambigue mm/dd.
8. **N10** fetch-fouten overal door `toErrorMessage`.
9. **M5** `renameFieldOption` transactioneel maken → één RPC (= **migratie 0045**; werkwijze zoals altijd: bestand schrijven, owner draait via `scripts/run-migration.mjs`, read-only verifiëren).

*Zoeken:* 10. **M4** `matchesSearch` (`tradeGrouping.ts` r.~103): `t.instrument` + custom velden meenemen — zoeken is feitelijk kapot voor non-forex journals.

*Uit Q doorgeschoven:* 11. **N2-lifecycle**: screenshot-storage-delete bij trade-delete/-vervanging, of een orphan-sweep (de account-delete wist sinds 0044 wél alles; dit gaat over losse trade-deletes die files achterlaten).

*Tests:* 12. `format.ts` (hele Fase J-weergavelaag, 0 tests), `tradeGrouping.ts`, `isoWeek.ts` (jaarwissel!), `computeOverviewKpis`-compositie.

*core.ts-uitbreiding voor S1/S2 (motor nu, views later):* 13. SQN/std-dev, grootste win/verlies, gem. risico per trade; drawdown-peak/trough teruggeven i.p.v. weggooien. Alles als pure functies in `src/lib/stats/` + tests — de StatCards/curve-markers komen pas in S.

## Sessie 2 — Opus (hygiëne, security-headers, polish)

- **S-M3** `npm audit fix` (react-router open-redirect-CVE-2025-68470) + build/tests groen.
- **S-M5** `vercel.json`: HSTS + Permissions-Policy toevoegen; CSP `connect-src` uitbreiden met Sentry-ingest. **⚠️ CSP-les uit het geheugen: `'wasm-unsafe-eval'` (react-pdf/Yoga) en de Google-Fonts-origins moeten blijven staan — breekt anders runtime-only.**
- **H2** admin-analyse gebruikt de methodologie van de kijkende admin i.p.v. de bekeken user (`AdminUserDetailPage.tsx` r.~214 + `BacktestingAnalysisView.tsx` r.~53) → `methodologyOverride`-prop (patroon van `hideFaseOverride`) + journal-scoping.
- **M6/L2** i18n-veegronde: "Weekly reviews"-kop, admin-tab-labels, streak-"0 none", journal-guard-meldingen.
- **N12** "Avg RR"-label; **N13** deleteJournal-waarschuwingen; **N15** native `confirm()` → ConfirmDialog + focus-trap in de wizard.
- *Perf quick wins:* mutaties lokaal patchen i.p.v. volledige refetch; fonts → WOFF2; periodieke SW-updatecheck (vóór PWA uit beta gaat); SWR-cache per scopeKey.
- *Git & repo:* lokale `main` bijtrekken (`git pull`); **`0036_revoke_anon_execute.sql` cherry-picken van branch `claude/jolly-cannon-8d47fc` naar main** (draait wél al op prod, bestand ontbreekt op main); stale gemergde branches opruimen; migratienummer-register in de docs kloppend maken.

## Klaar wanneer

Alle audit-bevindingen t/m MIDDEL dicht of bewust gedocumenteerd; lint/tests/build groen; repo-hygiëne op orde. Per sessie: review met owner, commit op eigen branch — push alleen op verzoek.

## Niet doen in R

- Geen server-side KPI-aggregatie (bewust uitgesteld, zie audit §3-perf).
- Geen S1/S2-views (kalendertotalen, histogrammen, StatCards) — alleen de core.ts-motor (sessie 1, punt 13).
- Turnstile/CAPTCHA blijft uit tot launch-week (Fase G) — niet aanraken.
- Terms/Privacy, beta-flip, landing page: allemaal Fase G.
