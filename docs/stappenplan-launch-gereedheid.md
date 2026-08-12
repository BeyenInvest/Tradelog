# Stappenplan — launch-gereedheid na productreview (2026-08-12)

> **Bron:** volledige productreview (code + live doorloop op productie via Chrome, ingelogd).
> **Doel:** de afstand dichten tussen "motor is launch-waardig" en "een vreemde gebruiker overleeft de eerste 10 minuten".
> **Werkwijze per fase:** eigen branch → bouwen → `npm run lint` + `npm run test` + `npm run build` groen → review met owner → pas committen/pushen op expliciet verzoek. DB-migraties via `scripts/run-migration.mjs` + `SUPABASE_DB_URL` — de owner draait ze, daarna read-only verifiëren.
> Volgorde = prioriteit. Fase A t/m D zijn pre-launch-musts; E/F sterk aanbevolen; G is de launch-checklist zelf.

---

## Fase A — Quick-fix-bundel (1 sessie, geen migraties)

Kleine, losse defects — samen op te pakken in één branch.

1. **Delete-bevestiging toont verkeerd instrument.** `TradeJournalView.tsx` (~regel 125): `t("journal.deleteConfirm", { pair: trade.pair })` → `trade.instrument ?? trade.pair`. Check meteen alle andere plekken die `t.pair` direct lezen buiten een forex-gate.
2. **NL lekt in de EN-UI.** `MONTH_NAMES` ("Januari…") en `WEEKDAYS` ("Ma/Di/Wo…") hardcoded in `constants.ts` (~119-128), gebruikt in kalender-kop, maandgroepering (`tradeGrouping.ts`), periodic-review-form en de "Per weekdag"-breakdown. Ook `"Ja"/"Nee"` als breakdown-keys (`breakdownDimensions.ts` ~51 en custom boolean-velden). Via i18n laten lopen.
3. **"Mijn journal" hardcoded NL** in de signup-trigger (`supabase/schema.sql`, `handle_new_user()`, ~587). Neutrale naam of client-side hernoemen bij onboarding (fase C). Kleine migratie.
4. **Lege custom-veld-kaarten in Analyse.** `BacktestingAnalysisView.tsx`: `customDimRows` filtert niet op `rows.length > 0` zoals `timingDimRows` (~93-95) wél doet → live gezien: 9 kaarten "Geen data." op een vers preset-journal. Zelfde filter toepassen.
5. **Screenshot-labels zijn WPM-timeframes voor iedereen.** `TechnicalSection.tsx` (~41-46): "Weekly/Daily/4H/2H screenshot (URL)" toont ook op blanco/futures/crypto-journals onder de kop "Technical analysis". Minimaal: neutrale labels ("Screenshot 1-4" of "Voor entry / Na exit"); de echte generalisatie (vrije screenshot-lijst) staat in het ontwerpdoc als latere cyclus.
6. **`window.confirm` bij trade-delete** vervangen door de bestaande modal-stijl.
7. **Dev-nit:** `.claude/launch.json` poort-mismatch (Vite viel terug op 5174, proxy wees naar dode poort) — `strictPort: true` in `vite.config.ts` of config poort-tolerant maken.

**Klaar wanneer:** EN-account ziet nergens NL; delete-dialoog toont juiste instrument; vers preset-journal toont geen lege kaarten.

---

## Fase B — Journal-beheer (1 sessie, geen migraties)

Live aangetoond probleem: twee journals heten beide "Weekly Phase Method", afgekapt tot "Weekly Ph…" — zelfs een oplettende gebruiker switcht naar het verkeerde boek.

1. **Rename** van een eigen journal (veld in `MethodologyEditor`-kop of potloodje in de switcher). `methodologies.naam` is al per-user; alleen UI + hook.
2. **Delete** van een eigen journal, met guards: niet het laatste journal, niet het actieve zonder eerst te switchen, en een expliciete waarschuwing met trade/review/account-tellingen ("bevat nog 12 trades"). Beslis: hard delete met cascade-waarschuwing, of blokkeren zolang er trades zijn (veiligste start).
3. **Switcher onderscheidbaar maken:** trade-teller per journal in de dropdown ("· 14 trades"), en tooltip/title met volledige naam bij truncatie.

**Klaar wanneer:** een dubbel journal kan hernoemd/verwijderd worden en de dropdown maakt boeken visueel onderscheidbaar.

---

## Fase C — Empty-state onboarding (1-2 sessies, geen migraties)

De exacte new-user-ervaring (live geverifieerd op "Mijn journal"): alles 0, "Nog geen trades voor een cumulatieve curve", geen enkele wegwijzer. De PresetPicker bestaat al en is goed — hij staat alleen verstopt (Settings → onderaan → uitklapkaart, achter beta-vlag).

1. **Empty-state in `TradeJournalView`** wanneer het actieve journal 0 trades én 0 velden heeft: kaart met "Kies een startsjabloon of begin blanco" + de bestaande `PresetPicker` inline (of prominente link) + "Log je eerste trade"-CTA. KPI-rij/charts verbergen tot er data is.
2. **Journal mét velden maar 0 trades:** lichtere variant — alleen "Log je eerste trade" + importeer-hint.
3. **Optioneel (de volwaardige wizard, longlist):** first-run-flow na eerste login — naam + timezone (nu stilzwijgend Europe/Brussels — fout voor niet-EU-users) + recept-keuze. Hergebruikt de PresetPicker; zie geheugen "Onboarding flow uitgesteld". Mag na de goedkope empty-state als aparte fase.

**Klaar wanneer:** een vers account ziet binnen 30 seconden wat het moet doen, zonder Settings te hoeven vinden.

---

## Fase D — Instrument-curatie per journal (1 sessie, evt. kleine migratie)

Live gezien: trade met instrument **"e"** in de Per Instrument-breakdown; vrije tekst versplintert analyses ("ES"/"es"/"MES" = 3 rijen).

1. **Per-journal instrumentenlijst** (ontwerpdoc §5): zelfde patroon als `custom_options`, of in `methodologies.instrument_config`. Beheer in Settings naast de veld-editor.
2. **Formulier:** `<select>`/combobox uit die lijst + "nieuw instrument toevoegen"-optie (normaliseer naar uppercase/trim). `useInstrumentSuggestions` bestaat al als basis.
3. **Bestaande junk-waarden:** eenmalige opschoon-UI of gewoon de trade-edit gebruiken.

**Klaar wanneer:** je kunt geen instrument van 1 losse letter meer opslaan zonder er bewust voor te kiezen, en breakdowns groeperen consistent.

---

## Fase E — Analyse-upgrades voor de serieuze trader (1-2 sessies, geen migraties)

1. **Profit factor** (bruto winst ÷ bruto verlies) als KPI in `computeOverviewKpis` + beide KPI-rijen. Bouwstenen liggen er (`computeExpectancy`).
2. **Huidige streak** ook in de Journal-tab-KPI-rij (staat al in Analyse; `currentStreak` wordt al berekend).
3. **Filters op custom velden.** `tradeFilters.ts` + `FilterPanel` uitbreiden zodat enum/boolean-velden van het actieve journal filterbaar zijn (ontwerpdoc §2.3 belooft dit al). Breakdown-kant bestaat al — dit maakt de config-belofte af. Grootste brok van deze fase.
4. Optioneel klein: win-rate excl. BE als toggle.

---

## Fase F — Reviews ont-WPM-en (1 sessie, migratie voor nieuwe kolom-namen óf alleen labels)

Live bevestigd: óók op een Futures-journal vraagt de weekly review naar "Verhalen", "Mentaal — Owner", "Mentaal — Trader" — owner-specifieke coaching-structuur als universeel sjabloon.

- **Minimaal (aanbevolen eerst):** labels neutraliseren — "Mentaal — Owner/Trader" → één veld "Mentaal" (of "Mindset & discipline"), "Verhalen" → "Wat speelde er deze week?". Alleen i18n + eventueel veld samenvoegen in de UI; kolommen blijven.
- **Later (configureerbare methodiek-lijn doortrekken):** review-secties per journal configureerbaar, zelfde patroon als methodology_fields. Niet nu.

---

## Fase G — Launch-checklist (aparte sessie, samen doorlopen)

Pas starten als A-D klaar zijn:

1. Turnstile + Supabase CAPTCHA her-activeren (README §5) — ⚠️ daarna Browser-pane niet meer op de app richten zonder overleg (zie geheugen).
2. Supabase: signup-toggle aan, URL-config, e-mailtemplates controleren.
3. Terms/Privacy: placeholder-teksten juridisch (laten) reviewen.
4. Landing page op `/` voor uitgelogde bezoekers (wat is Beyen, screenshots, CTA) — nu is de eerste indruk een kaal loginformulier.
5. `beta_features`-vlag flippen voor iedereen (of default true bij launch).
6. Smoke-test met een vers account: signup → onboarding → preset → eerste trade → analyse → review.

---

## Geparkeerd (bewust ná launch)

- **Geld/R als weergave-eenheid** (ontwerpdoc §6, cyclus 8) — grootste doelgroep-verbreder, maar te groot voor de launch-sprint.
- **Screenshot-upload** (Supabase Storage + paste-from-clipboard) — grootste dagelijkse QoL-win na launch.
- **Cyclus 10** (WPM-kolommen droppen, alles dynamisch) — lost `isLegacyMethodology`-complexiteit + placeholder-vervuiling (`pair='EURUSD'`, `fase='Fase 1'`) structureel op. Inplannen zodra soft-launch stabiel draait.
- Refetch-na-mutatie vervangen door lokale cache-update (performance bij grote imports); server-aggregatie = roadmap Fase 2.
- Duplicate-trade-knop + quick-add voor scalpers; account↔trades-koppeling (auto-P&L op prop-accounts); accounts/reviews empty-states.
