# Meta-audit — 2026-09-09

Volledige, meerlagige due diligence van Beyen Invest. Zeven parallelle specialistische deel-audits (product/scope, architectuur+AI-proces, rekenmotor, datamodel/security/legal, perf/ops/QA, UX/onboarding/a11y/i18n, business/GTM/concurrentie) plus eigen onderzoek van de hoofdsessie (workflow/founder, git-forensiek, kwaliteitspoorten), gevolgd door een adversariële verificatieronde waarin de zwaarste claims onafhankelijk zijn nagecheckt. Beoordeeld: working tree `fase-onboarding-ungate` (incl. uncommitted werk) **én** `origin/main` (die 8 commits vooruit staat en auto-deployt). Alles hieronder is zelf geverifieerd of expliciet gelabeld; de audit van 03-09 is als input gebruikt maar niet vertrouwd — waar die is achterhaald, staat dat erbij.

Labels: **BEVESTIGD** (file:line of eigen meting) / **WAARSCHIJNLIJK** / **VERMOEDEN**.

---

## Laag 1 — Het oordeel

**De eerlijke stand in één alinea.** Je hebt in zes weken een product gebouwd waarvan de kern — de rekenmotor, de security-laag, de datamodel-hygiëne per feature — aantoonbaar beter is dan wat de meeste gefinancierde teams neerzetten: een onafhankelijke handverificatie van de motor vond nul foute geld-getallen (34/34 asserts, missed-trade-gate aantoonbaar werkend), de RLS-laag is her-geverifieerd en sterk, en 399 tests draaien groen. **De "soep" die je voelt is geen kwaliteitsprobleem en geen feature-probleem — het is een integratie- en afrondingsprobleem.** Op dit moment bestaan er vijf halve werkstromen naast elkaar (uncommitted onboarding-werk dat gegarandeerd conflicteert met een remote sidebar-verbouwing, een launch-klare landing die al 6 dagen op een branch staat, drie geparkeerde import-branches), staat prod 8 commits vóór op je eigen checkout met drie features die in geen enkel repo-document bestaan, en is van de fixlijst van de vorige audit vrijwel niets geland terwijl er wél 3.300 regels nieuwe features bijkwamen. Het goede nieuws, en dit is gemeend: alles wat mis is, is proces en volgorde — niets ervan is rot. De afstand tot een verantwoorde gratis beta is klein en eindig: mergen, bevriezen, drie vangrails plaatsen, lanceren.

**De 5 dingen die écht tellen:**

1. **Er is geen vangnet buiten de code.** Geen CI (`.github/` bestaat niet — BEVESTIGD), geen automatische backups (free tier — WAARSCHIJNLIJK, README.md:8 zegt "gratis tier volstaat"), restore nooit getest, geen alerting, geen migratie-registratie. De kans op een fout is laag; de schade als er iets misgaat is maximaal en onomkeerbaar.
2. **De repo-staat ís de soep.** 5 open werkstromen, lokale main 11 commits achter origin/main, docs die prod een week achterlopen, en een gegarandeerd merge-conflict in `Sidebar.tsx`/`router.tsx` tussen het uncommitted werk en de remote nav-verbouwing (BEVESTIGD via git). Eerst opruimen, dan pas iets anders.
3. **De un-gate is half en breekt zijn eigen belofte.** Wizard + empty-state-builder gaan live voor iedereen, maar journal-switcher (Sidebar.tsx:58) en de hele Settings-journalsectie (SettingsPage.tsx:71) blijven beta-gated. Wie eerst een trade logt (de primaire CTA!) verliest de builder voorgoed (TradeJournalView.tsx:106) en zit permanent in een onbewerkbaar journal — terwijl wizard én nieuwe Gids beloven "je past alles later aan in Instellingen" (BEVESTIGD).
4. **Je concurreert met je zwakste kant naar voren.** De echte differentiator (conditionele veld-editor + multi-journal-isolatie — nergens bij de concurrentie gevonden) staat achter de beta-flag; het markt-table-stake (auto-import) is niet live. Ondertussen verzilvert Create Impacts al aan €19–29/maand.
5. **Er valt nog niets te meten en niets te factureren.** Nul analytics, geen wachtlijst, `profiles.plan` wordt nergens afgedwongen (BEVESTIGD via grep). De hele beta kan draaien zonder dat je ooit leert wát werkt.

**De grootste blinde vlek (niet door jou benoemd):** je benoemde "te veel features" en "er mentaal even uit" — maar het gevaarlijkste punt is dat **één databank-ongeluk vlak vóór of tijdens de beta alles van al je gebruikers onherstelbaar wist**, en dat je dat pas zou horen van een gebruiker. Geen backup, geen geteste restore, geen alerting, elke tabel cascadet vanaf `auth.users`, en het create-or-replace-regressiescenario is al één keer echt gebeurd (S2-1-lek via 0048, gedicht in 0052 — BEVESTIGD). Dit is één dag werk om te dichten en het staat op geen enkele van je lijstjes.

---

## Laag 2 — Harde waarheden

1. **De out-of-scope-lijst is drie keer overruled door jezelf.** Configureerbare methodiek: "out of scope" → gebouwd. MAE/MFE: idem. Discipline-tracking: expliciet uitgesloten in CLAUDE.md → bestaat nu driemaal (evaluatie-enum, Habits, Contract). Alleen "geen replay-engine" hield stand. Zolang "nee" onderhandelbaar is met jezelf om 21:00 's avonds, blijft elke scope-afspraak fictie.
2. **In het weekend na een audit die zei "eerst fixen, dan bouwen" gingen er vier feature-migraties naar prod en nul fixes.** De audit van 03-09 reserveerde migratienummer 0053 voor de schema-sync; 0053–0056 werden Trade Contract, Habits, Dagboek en Habits-builder (BEVESTIGD). Nuance die je verdient: de landing-sessie fixte haar auditpunten wél (69a681a "SEO-basics, H3/M5-audit-fixes") — maar mergde nooit. Het patroon is dus preciezer: **fixes gebeuren soms, integratie gebeurt nooit vanzelf.**
3. **De schemadrift is sinds de vorige audit gegroeid, niet gekrompen.** `trade_contracts` (0053) werd netjes in schema.sql meegenomen; `habits`, `habit_days` en `daily_journal_entries` (0054–0056) niet (BEVESTIGD via `git show origin/main:supabase/schema.sql`). De sync-conventie hield het precies één migratie vol. Conventies zonder gate eroderen — dat is geen karakterfout, dat is hoe conventies werken.
4. **Je product beschrijft zichzelf niet meer.** CLAUDE.md, README en masterplan noemen Habits/Dagboek/Contract nul keer en zijn voor het laatst aangeraakt op 28-08. De feitelijke productstatus leeft in chat-geheugens buiten de repo. Bij verlies van die laag (of gewoon: over drie maanden) begint iedereen — jij incluis — met archeologie.
5. **Augustus was niet vol te houden en dat wist je lijf eerder dan jij.** 212 commits in augustus (pieken 20:00–23:00), 3 in september, en de zin "er mentaal even uit". De grootste single point of failure van dit product is niet Supabase — het is jouw energie. Een proces dat afronden beloont in plaats van beginnen is directe risico-mitigatie, geen soft advies.
6. **"Beyen Invest" klinkt als een vermogensbeheerder en lekt op precies de publieke oppervlakken** (SharePageShell.tsx:29, ReviewPdfDocument.tsx:545 — BEVESTIGD). Het publieke merk is al correct "Beyen"; maak het af.
7. **De juridische aanbieder is anoniem.** "Een natuurlijke persoon in België" zonder naam voldoet niet aan art. 13 AVG en vrijwel zeker niet aan de Belgische WER-identificatieplicht. Het is een tekst-edit van een kwartier ná één beslissing — maar het is wel een echte beta-blokker, geen theorie.
8. **Een venture-case is dit niet, en dat is oké.** NL/BE-only draagt geen founder-salaris (dat vergt ~200–350 betalenden ≈ 5.000–17.000 geregistreerden — VERMOEDEN, ordegrootte); de realistische uitkomst bij goede executie is een gezond bootstrap-product richting €2–5k MRR met de EN-markt erbij. Richt je verwachtingen (en je energie-investering) daarop.

---

## Laag 3 — Dashboard

### Maturiteitsscores (0 = afwezig/gevaarlijk · 3 = werkt maar broos · 5 = launch-waardig, bewezen)

| # | Bril | Score | Grootste blokker |
|---|------|-------|------------------|
| 1 | Product & scope | **2** | Geen bindende feature-stop; un-gating per brokje i.p.v. per gebruikersreis |
| 2 | Architectuur & codekwaliteit | **3,5** | UI-duplicatie (5× IconBtn, 2 CRUD-hooks, 3 veld-formulieren) + 0 componenttests |
| 3 | Rekenmotor (productkern) | **4** | Weergave-consistentie (0,99R kalender naast 1,0R KPI) — niet de rekenkunde |
| 4 | Datamodel & migraties | **2** | Geen weg terug naar een werkende DB buiten prod; schema.sql boot niet; geen registry |
| 5 | Security, privacy & RLS | **4** | Techniek sterk; conventies (share-RPC, anon-revoke) alleen comment-verankerd; owner-e-mail in bundle |
| 6 | Compliance & juridisch | **3** | Anonieme aanbieder (AVG art. 13 / WER); verder verrassend goed op orde |
| 7 | Performance & schaalbaarheid | **3** | Alles-fetchen per journal; muur pas bij 3–5k trades (mobiel) — geen beta-blokker |
| 8 | Betrouwbaarheid & ops | **2** | Geen backups/restore/alerting — founder is blind én kan niets terughalen |
| 9 | Testing & QA | **2,5** | Obelisk i.p.v. piramide: 399 lib-tests, 0 daarboven, geen CI die iets afdwingt |
| 10 | Workflow, DevEx & founder | **2** | Niets is afdwingbaar (alles conventie); 5 on-geïntegreerde werkstromen; burst-crash-cadans |
| 11 | UX & interactie | **3,5** | Config-doodlopend spoor + rauwe EN-enums in NL-invoer |
| 12 | Onboarding & activatie | **4\*** | \*ná de uncommitted diff, en alléén als de drie gaten dicht gaan (was 2) |
| 13 | Design & merk | **3** | Nul social proof/founder-zichtbaarheid; "Beyen Invest"-lek op share/PDF |
| 14 | Toegankelijkheid | **2** | Field.tsx zonder label-associatie (alle formulieren naamloos); discard-dialog onbereikbaar per toetsenbord |
| 15 | i18n & lokalisatie | **4** | 1159=1159 keys, EN native-kwaliteit; enum-dropdowns rauw Engels; nl-BE-cijfers in EN |
| 16 | Businessmodel & unit economics | **1** | Geen prijs, geen enforcement, geen downgrade-pad; Pro-afbakening te dun |
| 17 | GTM, marketing & SEO | **2** | Geen werkende funnel: signup dicht, landing op branch, share-motor gated, nul meting |
| 18 | Concurrentie & differentiatie | **3** | Differentiator achter beta-flag, table-stake (import) niet live |
| 19 | AI-bouwproces als risico | **3** | Kennis leeft buiten de repo; geen CI = geen menselijke terugvaloptie van gelijke veiligheid |
| 20 | Toekomstbestendigheid | **3** | Legacy-WPM-vertakking in ±20% van de bestanden, groeit per feature; cyclus 10 wordt elke maand duurder |

Gemiddeld ≈ **2,8/5** — maar het gemiddelde misleidt: de spreiding is het verhaal. Alles wat *code* is scoort 3,5–4; alles wat *proces, vangnet of geld* is scoort 1–2,5. Het risicoprofiel is daarmee omgekeerd aan wat de codekwaliteit suggereert.

### Risicomatrix (kans × impact)

| Risico | Kans | Impact | Nu zichtbaar? |
|---|---|---|---|
| Merge-conflictgolf Sidebar/router bij integratie | **Zeker** | Middel | Ja (BEVESTIGD) |
| Beta-gebruiker loopt vast op gated config na landing/wizard-belofte | **Hoog** (zonder flag-besluit) | Hoog — kleine doelgroep, reputatie éénmalig | Ja (BEVESTIGD, 3 gaten) |
| Nooit echt lanceren; Create Impacts verzilvert de markt | Middel–hoog | Hoog | Ja (B5/B6 5+ weken open) |
| Founder-burnout / integratie-stilstand | Middel–hoog | Maximaal | Ja (212→3 commits) |
| Stille security-regressie via create-or-replace zonder registry/CI | Middel (precedent bestaat) | Hoog (privacy-incident, meldplicht-afweging) | Ja (S2-1-geschiedenis) |
| Totaal dataverlies (geen backup, restore nooit getest) | Laag–middel | **Maximaal, onomkeerbaar** | Ja (free tier, WAARSCHIJNLIJK) |
| PWA-autoreload vernietigt dirty formulier | Middel | Middel | Ja (C-R2-1, nog open) |
| Anonieme aanbieder (AVG/WER) | Laag (handhaving) | Laag–middel | Ja (fix = kwartier) |
| Performance-muur | Laag (pas 3–5k trades) | Laag–middel | Ja, gemodelleerd |

---

## Laag 4 — Per bril

Volledige deelrapporten met alle vier-lagen-analyses zijn in deze sessie geproduceerd; hieronder per bril de stand, de kernbevinding(en) met bewijs, en één aanbeveling. Ernst: 🔴 blokkerend vóór beta · 🟠 vóór betaald/schaal · 🟡 poets.

### 1. Product & scope — 2/5
**Stand:** ~20 schermen, 24 features, ~32.900 LOC effectief op prod, 15 Settings-kaarten. Kern (log → stats → review) ≈ 8.900 LOC ≈ **27%** van de code. De soep concreet: 4 wegen om een trade in te voeren; **5 reflectie-oppervlakken** (weekly + M/Q/Y-reviews + Dagboek + Habits + Contract); dezelfde cijfers in 5 renderingen; 2 config-systemen naast elkaar; 2.252 LOC import-code die nog nooit een echte broker-CSV zag (eigen comment TradeJournalView.tsx:206-208).
**Vier lagen (kernbevinding):** symptoom = "soep"-gevoel en 5+ weken openstaande launch; oorzaak = bouwen is goedkoper dan lanceren (een feature kost een avond met AI, lanceren kost eigenaar-acties: Turnstile, jurist, marketing); systemisch = de out-of-scope-lijst is 3× overruled en un-gating gebeurt per flag i.p.v. per gebruikersreis; strategisch = zonder launch is er geen signaal over wat kern is — het enige de-soep-mechanisme dat echt werkt (échte gebruikers) wordt steeds uitgesteld.
**Aanbeveling:** bindende feature-stop tot na de beta-launch; de-soep-lijst in Laag 5 uitvoeren.

### 2. Architectuur & codekwaliteit — 3,5/5
**Stand:** lagenrichting pages→components→hooks→lib vrijwel schoon (2 kleine violaties, o.a. fieldBlocks.ts:2); error-handling opvallend uniform (192× setError, 0 toasts); stats-kern voorbeeldig. Ongezond: CustomFieldsSection.tsx (744 LOC = tweede schema-beheer-UI ín het trade-formulier) en het methodology-cluster: **2 volledige CRUD-hooks over dezelfde tabel** (useMethodology.tsx:287-350 + useMethodologyEditor.ts:120-158) en **3 veld-toevoegen-formulieren** — elke wijziging aan veld-aanmaak moet op 5 plekken (🟠).
**Aanbeveling:** gedeelde `IconBtn` + één `FIELD_TYPES` (1 uur werk) en de CLAUDE.md-regel "UI-bouwstenen eerst in components/ui zoeken" — zie bril 19 voor waarom dat werkt.

### 3. Rekenmotor — 4/5
**Stand:** onafhankelijk her-geverifieerd: 5 geld-kritieke berekeningen met de hand nagerekend op een eigen fixture en tegen de echte code gedraaid — **34/34 PASS, nul foute getallen**; alle som-plekken buiten `src/lib/stats/` routeren door `closedTrades(takenTrades(...))` (BEVESTIGD sweep); randgevallen (0 trades, alleen missed/open/BE, risk 0, extreme waarden) crashen nergens. Tests zijn géén formule-naäperij (drawdown-reeksen handgeschreven in comments).
**Maar:** de complete poetslijst van de vorige audit staat na twee audits nog integraal open — 0 van 7 punten gefixt (elk met file:line herbevestigd), waarvan één **zichtbaar** voor gebruikers: maandtotaal 0,99R naast KPI 1,0R (calendarTotals.ts:75-80, live gereproduceerd) 🔴-randje, en de kruistabel kan nog steeds Sessie×Sessie openen (CrossTable.tsx:67, één-regel-fix) 🟠.
**Aanbeveling:** één poets-sessie: N-R2-1-regel → kalender/PDF op de gedeelde raw-som/`computeEquityCurve` → één round-half-away-from-zero-helper → `computeDurationByOutcome` naar `ClosedTrade[]`.

### 4. Datamodel & migraties — 2/5
**Stand:** per-feature-discipline is goed (open-trade-invariant voorbeeldig DB-enforced, schema.sql:164-188), maar het systeem eromheen niet: schema.sql **boot niet** (FK's naar `methodologies` op r81/110/245 vóór de CREATE op r289 — BEVESTIGD), share-laag/`create_journal`/`periode_overzicht` ontbreken, drift gegroeid met 0054–0056, run-migration.mjs registreert niets (geen `schema_migrations` — BEVESTIGD), nummer 0020 dubbel, en het create-or-replace-rampscenario is al eens echt gebeurd (S2-1). Client-only invarianten: geen `datum_sluiting >= datum_open`-check (duur kan negatief), geen één-actief-account-constraint 🟠.
**Vier lagen:** symptoom = geen machine weet wat prod draait; oorzaak = handmatige migraties zonder administratie; systemisch = de waarheid over de DB leeft alléén op prod + in chat-geheugen; strategisch = **disaster recovery = Supabase of niets**, en elke security-fix in een RPC kan stil terugdraaien 🔴.
**Aanbeveling:** één Fable-sessie: schema.sql-sync t/m 0056 (werklijst bestaat: `docs/schema-sync-werklijst-2026-09.md`, nog accuraat) + minimale `schema_migrations`-tabel + `rejectUnauthorized: true` in de runner.

### 5. Security, privacy & RLS — 4/5
**Stand:** onafhankelijk her-geverifieerd en sterk: RLS op alle tabellen incl. nieuwste, K1-kolomgrant dicht, alle 13 definer-functies met gepind search_path, storage privé met padsegment-RLS, anon-oppervlak exact 2 bedoelde RPC's, secrets schoon, share-tokens ~244 bits met strakke allow-list (notes + custom gaan bewust mee; user_id/prop-data/bucket-paden niet).
**Open:** owner-e-mail hardcoded in de publieke bundle (useAuth.tsx:64 — BEVESTIGD, ook vandaag nog) 🔴; tokens plaintext in DB 🟡; conventies (0036-revoke, 0052-vertrek-van-laatste-body) alleen in comments verankerd 🟠; server-side wachtwoordminimum + leaked-password-check niet verifieerbaar vanuit repo (VERMOEDEN — dashboard-check).
**Aanbeveling:** owner-e-mail vervangen door `beta_features=true` op de owner-rij; launch-volgorde bewaken: éérst Turnstile aan, dán signup open.

### 6. Compliance & juridisch — 3/5
**Stand:** beter dan verwacht. Teksten dekken de realiteit (screenshots, share-links, Sentry `sendDefaultPii:false`, écht geen analytics — allemaal BEVESTIGD tegen de code); account-delete is AVG-degelijk (storage + share_links + alles cascadet — BEVESTIGD); "geen beleggingsadvies"-disclaimer aanwezig; MiFID-inschatting gunstig (pure statistiek over eigen data, geen aanbevelingspad — WAARSCHIJNLIJK vergunningsvrij, jurist bevestigt kort).
**Blokker:** de aanbieder is anoniem 🔴 (art. 13 AVG + Boek XII WER). Kan wachten tot betaald: herroepingsrecht, betaalverwerker, export-knop (de handmatige e-mail-route is geldig voor beta; let op: de b5-branch heeft al `exportCsv.ts`).
**Aanbeveling:** naam + contactweg in Terms §1/Privacy §1 + één jurist-leespas (review, geen herschrijf); DPA's afvinken en Supabase-regio verifiëren.

### 7. Performance & schaalbaarheid — 3/5
**Stand:** gemodelleerd: 5.000 trades = 4–7,5 MB in 5 **seriële** requests (fetchAll.ts:30-36) = 2–8 s koude start; 100 gebruikers triviaal; ~1.000 gebruikers = free-tier-egress-plafond (oplossing: $25/mnd Pro); 10.000 = architectuur houdt (per-user RLS), muren worden kosten + support. Statslaag goed gememoized (16-17× useMemo, één view gemount) — geen render-probleem; indexen dekken het hete pad (composiet 0052:233).
**Uitdaging aan de roadmap:** Fase 2 (server-aggregatie) is **premature** — kolomselectie (Analyse gebruikt notes/screenshots niet) + parallelle paginatie schuiven de muur 5–10× op tegen een fractie van de kost én zonder de geteste statslaag in SQL te dupliceren 🟡.
**Aanbeveling:** niets vóór beta; daarna kolomselectie + parallelle fetch, Fase 2 pas bij structureel >5k trades/journal.

### 8. Betrouwbaarheid & ops — 2/5
**Stand:** UI-foutafhandeling verrassend goed (profileError-retry, error-states, ErrorBoundary); Sentry-code netjes maar sourcemaps ontbreken en DSN-status onverifieerbaar; verder: geen uptime-check, geen alerting, geen runbook, geen backup-script, restore nooit getest (VERMOEDEN), bus-factor 1 op Supabase/Vercel/DNS/migraties. Anonieme share-RPC bouwt ongelimiteerde full-journal-aggregaties zonder caching (0040:104-158) — gelekte link + bot kan de gedeelde free-tier-DB vertragen 🟡.
**Aanbeveling (🔴, één dag):** Supabase Pro óf dagelijkse pg_dump via de bestaande `SUPABASE_DB_URL` + **één keer een restore oefenen** + gratis uptime-ping + Sentry-DSN bevestigen.

### 9. Testing & QA — 2,5/5
**Stand:** 399 sterke tests, allemaal onder `src/lib/` — een obelisk, geen piramide. 0 hook-tests (useTrades/useAuth = de laag waar de C-bugs zaten), 0 component-tests (structureel onmogelijk: vitest `environment:"node"`, vite.config.ts:95-96), 0 SQL/RLS-tests (de laag waar M1-a en het S2-1-lek zaten), geen ESLint (de disable-comments in de code wijzen naar een tool die er niet is), en **geen CI** — zelfs de 399 bestaande tests zijn feitelijk optioneel.
**Aanbeveling:** CI-workflow (30 min — de goedkoopste risicoreductie van dit hele document), daarna jsdom-fix + 5–8 hook-tests (1 dag), daarna één Playwright-smoke tegen een seed-DB (1–2 dagen; de enige laag die de SQL-klasse vangt).

### 10. Workflow, DevEx & founder — 2/5
**Stand (eigen onderzoek hoofdsessie):** momentopname 09-09: lokale main **11 commits achter** origin/main; 3 features op prod die in geen repo-doc bestaan; uncommitted werk dat gegarandeerd conflicteert met remote wijzigingen; branch met mismatchende commit-onderwerpen (`weekly-review-pdf-polish` bevat "Fase I: CSV-header-detectie"); orphan-stash; commit-cadans 16 (jul) → 212 (aug, pieken 20–23u) → 3 (sep). Wat wél werkt: kwaliteitspoorten worden gedraaid, backup-branch-conventie bestaat, de audit-fix-loop werkt op codeniveau (T1–T3 aantoonbaar gefixt), CLAUDE.md is van hoge kwaliteit — tot 28-08.
**Vier lagen:** symptoom = 5 halve werkstromen; oorzaak = parallelle sessies delen geen live-beeld en de founder is de enige integrator; systemisch = "klaar" betekent "code groen", niet "op main" — er is geen definition of done die mergen omvat, en niets is een gate (alles conventie); strategisch = elke parallelle sessie verhoogt jóuw cognitieve last — het proces dat productie versnelt sloopt het overzicht en de rust.
**Aanbeveling:** max 1 open werkstroom tegelijk tot na de launch; "klaar = gemerged op main + docs bijgewerkt" als bindende definitie.

### 11. UX & interactie — 3,5/5
**Stand:** de kernflow is goed: preset-journal ~3-4 interacties per simpele trade (prefills, auto-outcome, instrument/risk-memory), quick-log ("Bewaar & volgende") is de beste flow in de app; errorMessage.ts degelijk. Frictie: lege staten Reviews/Accounts/Backtesting zijn één regel muted tekst zonder uitleg of Gids-link; ~8 concepten voor een nieuweling (de nieuwe HelpPage dekt ze — goede toevoeging); rauwe Engelse enums in de NL-invoerkant ("Good trade", "Win/Loss" — EnumSelect.tsx:29-31 zonder getLabel, terwijl de wéérgavekant wél vertaalt) 🟠.
**Aanbeveling:** getLabel voor OUTCOMES/TRADE_EVALUATIONS/DIRECTIONS + één zin met Gids-link in de drie lege staten.

### 12. Onboarding & activatie — 4/5\* (ná de diff; ervoor 2)
**Stand:** het uncommitted werk is de juiste stap: wizard (naam + gegokte tijdzone) → journal-builder met startsets → empty-state-vangnet → nieuwe Gids-pagina. Maar **O1 is half dicht** — drie gaten, alle BEVESTIGD: (1) de builder-ingang verdwijnt permanent na trade #1 (TradeJournalView.tsx:106) terwijl switcher (Sidebar.tsx:58) en Settings-config (SettingsPage.tsx:71) beta-gated blijven → journal voorgoed onbewerkbaar; (2) wizard-copy en 5 van 7 Gids-items beschrijven UI die een niet-beta-gebruiker nergens vindt; (3) de primaire CTA ("Log je eerste trade") staat bóven de builder en leidt dus recht het doodlopende spoor in 🔴.
**Aanbeveling:** binnen dezelfde diff: Settings-journalsectie + switcher mee un-gaten (het schoonste, en het zet meteen je differentiator voor) óf copy afzwakken + een blijvende config-ingang toevoegen.

### 13. Design & merk — 3/5
**Stand:** landing-copy is het beste GTM-asset (heldere anti-hype-positionering, eerlijke FAQ, één CTA); 10-seconden-test slaagt. Ontbreekt: elke vorm van social proof, founder-naam/gezicht, prijs ("volgt"). "Beyen Invest" lekt op share-pagina's en PDF (BEVESTIGD) terwijl het publieke merk al correct "Beyen" is 🟡.
**Aanbeveling:** twee regels code ("Beyen Invest" → "Beyen"); overweeg jezelf als social proof — naam + eigen live journal-stats op de landing past exact bij het merk "bewijs, geen hype".

### 14. Toegankelijkheid — 2/5
**Stand:** screenreader-oordeel: **niet werkbaar** voor het kernwerk. Field.tsx:19-23 associeert geen enkel label (elk formulierveld "naamloos"); de discard-dialog rendert búiten de focus-trap-container zodat een toetsenbordgebruiker "Niet opslaan" onmogelijk kan bereiken (Modal.tsx/TradeForm.tsx:308 + useModalGuard.tsx — erger dan de vorige audit noteerde); alle 5 recharts-charts zonder enige aria (grep leeg); `text-faint` faalt AA (≈2,5-2,6:1) op precies de veldhints. Wél goed: focus-traps, aria-modal, reduced-motion in de nieuwe wizard, echte `<table>`-markup in breakdowns.
**Aanbeveling:** Field.tsx htmlFor/id (één component = vrijwel alle formulieren) + discard-dialog binnen de trap met autofocus. Samen < 1 dag, grootste a11y-ROI beschikbaar.

### 15. i18n & lokalisatie — 4/5
**Stand:** 1159 = 1159 keys, perfect sync ook ná de +44 (BEVESTIGD); EN is native-kwaliteit (steekproef 20 strings). Open: enum-dropdowns rauw Engels (zie bril 11); `formatEUR`/LotSize hardcoded nl-BE (EN-gebruiker ziet "1.234,56" — format.ts:7); taal localStorage-only (copy is er eerlijk over); economische-kalendertijden in browser-tz i.p.v. de profiel-tz die de wizard net uitvroeg (EconomicEventRow.tsx:8).
**Aanbeveling:** enum-vertaling eerst; de rest is post-launch poets.

### 16. Businessmodel & unit economics — 1/5
**Stand:** geen prijs, geen Stripe, geen enforcement — `profiles.plan` wordt alleen getoond (AdminUsersListPage.tsx:62), nergens gecheckt (BEVESTIGD). Markt geverifieerd (2026): TradeZella $35–99, TraderSync ~$30–80, Edgewonk $197/jr, Tradervue $0–50, **Create Impacts €0/19/29 live**. Realistische Pro-prijs: €9–15. Infra gedekt bij 4–6 betalenden; founder-salaris vergt ~200–350 betalenden → **EN-markt verplicht voor het salaris-scenario**. De geplande Pro-afbakening ("meer journals + presets") is te dun — de meeste hobby-traders hebben één methodiek.
**Aanbeveling:** prijs prikken, minimale entitlement-check bouwen (desnoods ongebruikt, maar bestaand), en iets dagelijks voelbaars in Pro plannen (weekly digest; later AI over de gestructureerde velden — dáár is de veld-editor ineens een data-moat).

### 17. GTM, marketing & SEO — 2/5
**Stand:** geen werkende funnel: signup server-side dicht, landing op een branch, share-motor beta-gated, nul analytics, geen wachtlijst — elke vroege bezoeker verdampt. **Correctie op audit-03-09:** H4 (SEO ontbreekt) is op de b5-branch grotendeels gefixt — robots.txt, sitemap.xml, OG-meta én CSV-export bestaan daar (BEVESTIGD, commit 69a681a) — het is alleen nooit gemerged. Kanaal #1 voor €0-budget: NL/BE-communities (daytradingcommunity.nl, DeDaytrader, Trade & Connect, prop-Discords — bestaan geverifieerd) + coaches via share/PDF als multiplicator. Dit is een Discord-product, geen Google-product.
**Aanbeveling:** volgorde: beta-flag-besluit → B6-launchweek → landing naar prod → Plausible/analytics + wachtlijst-fallback. Eerste growth-feature ná launch: één deelbare maand-kaart met OG-image.

### 18. Concurrentie & differentiatie — 3/5
**Stand:** eerlijk oordeel: het echte alternatief is de spreadsheet; Beyen wint op rekencorrectheid en frictie, verliest op flexibiliteit en auto-import. De differentiator — conditionele veld-editor + multi-journal-isolatie — **bestaat echt** en is bij geen enkele concurrent gevonden (BEVESTIGD in repo-doc + eigen 2026-check); maar hij staat achter de beta-flag terwijl handinvoer (de zwakte) vooraan staat. Repo-concurrentiedocs bleken actueel en níet zelf-feliciterend (zelf her-geverifieerd, incl. Create Impacts-pricing live gefetcht). "Geen replay, TV is king" = juiste keuze; maakt frictieloze TV/MT-import wél de navelstreng. NL-talig = strandhoofd, geen moat.
**Aanbeveling:** de import un-gaten zodra hij tegen één echte MT/TV-export gevalideerd is — dit is de dealbreaker van de power-trader (persona Ruben: "als de import er is, stap ik over en betaal ik €10-15").

### 19. AI-gedreven bouwproces — 3/5
**Stand:** dit is een ongewoon goed uitgevoerde AI-build (lagen schoon, kern 1× geïmplementeerd, tests echt). Maar de risico's zijn meetbaar aanwezig: 92/197 bronbestanden bevatten proces-archeologie in comments ("cyclus" 60×, migratienummers 84×, "audit T2"); 5× IconBtn, 2× FIELD_TYPES, 2 CRUD-hooks, 3 veld-formulieren; de feitelijke productstatus leeft in ~35 memory-files en chat-geheugens buiten de repo.
**De belangrijkste procesles van deze hele audit (BEVESTIGD):** de gevaarlijke kern (missed-filter, round2, sortChronological) bestaat exact 1× — omdat die in CLAUDE.md staat. De duplicatie zit uitsluitend waar CLAUDE.md zwijgt. **Het AI-proces volgt aantoonbaar wat opgeschreven staat, en rafelt waar niets opgeschreven staat.** Dat maakt de fix goedkoop: niet minder AI, maar méér vastgelegde conventie + één afdwingbare gate (CI).
**Aanbeveling:** CLAUDE.md bijwerken (Habits/Dagboek/Contract, UI-bouwstenen-regel, "klaar = gemerged") — het is bewezen het krachtigste stuurinstrument dat je hebt.

### 20. Toekomstbestendigheid — 3/5
**Stand:** het custom-fields-fundament (`trades.custom` jsonb + `methodology_fields`) is draagkrachtig en de juiste architectuur voor de pivot; zwakke plekken: client-only validatie van de jsonb-bag (validation.ts:113 `z.unknown()` vs beloofd type-union; geen server-side checks — bij CSV-import op schaal een crash-kandidaat) en de legacy-WPM-dubbelwerkelijkheid: **38–42 bestanden (±20% van src) vertakken op isLegacy/fase** en dat groeit per feature zolang cyclus 10 uitgesteld blijft. i18n houdbaar tot 3-4 talen; statslaag sterkste onderdeel.
**Aanbeveling:** cyclus 10 (de-hardcoding legacy-velden) inplannen vóór de volgende featuregolf — elke maand uitstel maakt hem meetbaar duurder.

---

## Laag 5 — De beslissingen

### Als je vóór de beta maar 5 dingen doet

1. **De grote schoonmaak-sessie (1 dag).** Alles integreren of expliciet archiveren: `fase-onboarding-ungate` rebasen op origin/main (Sidebar/router-conflict bewust oplossen), de drie un-gate-gaten dichten (Settings + switcher mee un-gaten is het schoonste), `fase-b5-landing` mergen, de import-branches expliciet parkeren met een README-regel, de stash opruimen. Daarna: CLAUDE.md bijwerken met de werkelijke productstand. **Effect: de soep is weg — niet door te schrappen, maar door te integreren.**
2. **De vangrails (1 dag).** CI-workflow (lint + test + build op elke push, ~30 min), Supabase-backups (Pro óf pg_dump-cron via de bestaande `SUPABASE_DB_URL`) + één geoefende restore, gratis uptime-ping, Sentry-DSN bevestigen.
3. **Schema-sync-sessie (1 sessie, Fable).** Werklijst `docs/schema-sync-werklijst-2026-09.md` uitvoeren, aangevuld met 0054–0056 (habits/dagboek — ontbreken óók in schema.sql, nieuw sinds de werklijst) + minimale `schema_migrations`-registry + owner-e-mail uit de bundle.
4. **Jurist-uur + naam (halve dag eigen werk).** Naam + contactweg in Terms/Privacy; één juridische leespas; "Beyen Invest" → "Beyen" op share/PDF; DPA's afvinken; Supabase-dashboard-checklist (regio, wachtwoordbeleid, backups-tier).
5. **B6-launchweek.** Turnstile aan → Supabase URL-config/SMTP → signup open → landing live → Plausible + wachtlijst. In déze volgorde; CAPTCHA vóór signup.

Samen: **ruwweg 5–7 werkdagen.** Dat is de werkelijke afstand tot een verantwoorde beta.

### Stoppen / schrappen / bevriezen (de de-soep-lijst)

**Stoppen (gedragsregel, belangrijker dan elke schrap-actie):**
- Geen nieuwe features tot na de beta-launch. Geen nieuwe migraties behalve de sync. De out-of-scope-lijst is alleen betekenisvol als "nee" ook 's avonds om 21:00 geldt.
- Max 1 open werkstroom tegelijk. "Klaar" = gemerged op main + docs bij.

**Bevriezen (blijft bestaan, geen commit meer aan, geen uitbouw):**
- Habits + Dagboek + Contract (Contract is al owner-only; Habits/Dagboek live laten is een gemaakte keuze — maar bevries ze).
- Review-PDF (incl. de polish-branch), share-links, MAE/MFE-laag.
- CSV-import: bevroren tot de eerste échte MT/TV-export binnen is; dan valideren en un-gaten (dit is bewust géén schrap-kandidaat — het is je table-stake).
- EN-copy: bevriezen op huidige stand; nieuwe copy mag tijdelijk NL-first.

**Samenvoegen / degraderen (post-launch, niet nu):**
- Monthly/quarterly/yearly reviews → één "periodieke review" met periode-keuze (code al grotendeels gedeeld — vooral nav-vereenvoudiging).
- Economic calendar + lot-size → onder één "Tools"-item (main's hergroepering is al een half antwoord); calendar is de enige echte schrap-kandidaat als je ooit wilt snijden.

**Níet schrappen (expliciet, tegen de schrap-reflex in):** backtesting, accounts/prop-tracking, quick-log, de journal-config-laag zelf — dat is de pivot-kern en de differentiator. De soep zit niet in deze features maar in de on-geïntegreerde staat eromheen.

### Gesequencede roadmap (effort × impact)

| Wanneer | Item | Effort | Impact |
|---|---|---|---|
| **Nu (deze week)** | Schoonmaak-sessie: rebase + un-gate-gaten dicht + landing mergen + CLAUDE.md bij | 1 dag | ★★★★★ |
| Nu | CI + backups + restore-oefening + uptime | 1 dag | ★★★★★ |
| Nu | Schema-sync 0057 + registry + owner-e-mail eruit | 1 sessie | ★★★★ |
| Nu | Poets die zichtbaar is: kalendertotalen-drift, kruistabel-regel, PDF-equity op gedeelde curve | ½ dag | ★★★ |
| **Beta-week** | Jurist-uur + naam in Terms + "Beyen"-fix + dashboard-checklist | ½ dag | ★★★ |
| Beta-week | B6: Turnstile → signup open → landing live → analytics + wachtlijst | 2–3 dagen owner-werk | ★★★★★ |
| Beta-week | Field.tsx-labels + discard-focus + enum-vertaling + lege-staten-zinnen | 1 dag | ★★★ |
| **Post-launch (eerst meten!)** | PWA-reload-guard (C-R2-1) + visibility-refetch (C-R2-2/C3) | 1 dag | ★★★ |
| Post-launch | Import valideren met echte CSV's → un-gaten (dealbreaker power-traders) | 1–2 dagen | ★★★★ |
| Post-launch | Prijs + entitlement-check + Pro-verrijking (digest) | 3–5 dagen | ★★★★ |
| Post-launch | jsdom-fix + hook-tests + 1 Playwright-smoke | 2–3 dagen | ★★★ |
| Post-launch | Maand-kaart met OG-image (growth-loop) | 1–2 dagen | ★★★ |
| Later | Cyclus 10 (legacy-de-hardcoding) — vóór de volgende featuregolf | groot | ★★★ |
| Later | Kolomselectie + parallelle fetch (i.p.v. premature server-aggregatie) | 1 dag | ★★ |
| Later | Reviews samenvoegen, Tools-degradatie, IconBtn/FIELD_TYPES-dedup, ESLint | divers | ★★ |

---

## Laag 6 — Pre-mortem & blinde vlekken

**Het is september 2027 en Beyen is gestopt. Het autopsierapport:**

**Doodsoorzaak 1 — Het lanceerde nooit echt (meest waarschijnlijk).** De beta bleef "twee weken weg" terwijl er features bijkwamen; elke audit produceerde een lijst, elke week produceerde in plaats daarvan code. De founder-energie liep in golven leeg (augustus: 212 commits; september: 3) en elke herstart begon met een week integratie-archeologie. Create Impacts — technisch zwakker, commercieel actief — pakte ondertussen de Benelux-niche en de EN-gefinancierde spelers de rest. *Op 09-09-2026 al zichtbaar aan:* B5/B6 5+ weken open naast 3.300 LOC nieuwe features in één weekend; de fixlijst-van-0053 die features werd.

**Doodsoorzaak 2 — Het eerste cohort werd verbrand.** De landing beloofde een journal dat zich naar jou vormt; de eerste 30 gebruikers uit daytradingcommunity.nl bouwden er een, logden een trade, en konden daarna niets meer aanpassen (of haakten af op handinvoer omdat de import gated was). In een community van die omvang is er geen tweede eerste indruk; de naam was "dat halve journal". Er waren geen analytics om het afhaken zelfs maar te zíen. *Al zichtbaar aan:* de drie bevestigde un-gate-gaten; nul meting; de import-gate.

**Doodsoorzaak 3 — Het incident.** Een migratie-ongeluk of een create-or-replace-regressie (het was al eens gebeurd) op een vrijdagavond; geen backup op free tier, geen alerting, ontdekt via een gebruikers-DM op zondag. De data van elke beta-gebruiker weg of het lek een week live. Voor een product waarvan het merk letterlijk "cijfers die niet liegen / eyes on every trade" is, was één vertrouwensincident dodelijk. *Al zichtbaar aan:* free tier zonder backups, geen registry, geen CI, S2-1-precedent.

**Dwarsliggende oorzaak onder alle drie:** niets was afdwingbaar en niemand anders keek mee. Elke verdediging was een conventie in een comment of een geheugen in een chat; de enige integrator, ops-engineer, jurist-opdrachtgever én marketeer was dezelfde vermoeide persoon.

**Overige blinde vlekken (klein maar onbenoemd):**
- De wizard-belofte "je past alles later aan" is nu de meest riskante zin in het product — copy die de gating tegenspreekt bij exact de sceptische doelgroep die overdrijving niet vergeeft.
- `formatEUR` hardcoded nl-BE: de EN-versie (verplicht voor het salaris-scenario) toont getallen die een US-lezer verkeerd leest.
- De 30-min-PWA-update-poll kan midden in een lange review-tekst een harde reload doen (C-R2-1) — het "invoer kwijt"-incident wacht op zijn eerste slachtoffer.
- Prop-target 0% → NaN-progressbar (propFirm.ts:68, VERMOEDEN, cosmetisch).

---

## Laag 7 — Appendix

### Zelf gedraaide cijfers (2026-09-09, working tree)

- `npm run lint` (tsc --noEmit): **schoon** · `npm run test`: **399/399 groen** (31 files, 12,5 s) · `npm run build`: **slaagt** (20,9 s) · `npm audit`: **1 high + 2 moderate** (fast-uri, vitest — alles dev-keten; runtime 0).
- Bundle: index 604,8 kB min / 176,2 kB gzip · recharts-chunk 576 kB · react-pdf lazy 1.468 kB · PWA-precache 69 entries / 1,6 MB.
- Omvang: 234 TS/TSX-files, ~30.006 LOC src (working tree), ~32.900 effectief op prod; 3.930 LOC tests; 2×1.159 i18n-keys (exact sync); 56 migratiebestanden op main (0020 dubbel, 0034 bewust gat); 231 commits (16 jul / 212 aug / 3 sep); 20 docs-files, 2.357 regels.
- Git-staat: lokale main 11 achter origin/main; HEAD 8 achter; 5 open werkstromen; 3 backup-branches; 1 orphan-stash.

### Kern-bewijsplaatsen (selectie)

| Claim | Bewijs |
|---|---|
| Un-gate-doodlopend spoor | TradeJournalView.tsx:106 · Sidebar.tsx:58 · SettingsPage.tsx:71 (alle drie zelf herlezen in verificatieronde) |
| Motor correct | Eigen fixture, 34/34 asserts; lek-demo: zonder takenTrades() springt +1,9% → +6,9% |
| Kalender-drift zichtbaar | calendarTotals.ts:75-80,87 — 3×⅓R → maand 0,99R naast KPI 1,0R (gereproduceerd) |
| schema.sql boot niet | schema.sql:81/110/245 FK's vóór CREATE methodologies :289 |
| Drift gegroeid | `git show origin/main:supabase/schema.sql`: trade_contracts wél, habits/habit_days/daily_journal_entries níet |
| Geen migratie-registry | run-migration.mjs integraal; grep schema_migrations = 0 |
| Owner-e-mail in bundle | useAuth.tsx:64 (zelf herlezen) |
| Geen plan-enforcement | grep plan/limit/entitlement over src = alleen weergave AdminUsersListPage.tsx:62 |
| Fixlijst 0/7 motor-punten | duration.ts:9 · reviewPdfData.ts:191-197 · breakdown.ts:189 · core.ts:567,276-279 · calendarTotals.ts:75-87 · CrossTable.tsx:67 (timing-tak zonder rij-exclusie — zelf herlezen) |
| Landing-branch heeft SEO+export | public/robots.txt + sitemap.xml + 10 OG/meta-hits + exportCsv.ts op fase-b5-landing (69a681a) |
| Docs stale vs prod | grep habit/dagboek/contract in CLAUDE.md/README/masterplan = 0; laatst aangeraakt 28-08 |
| AI dupliceert het ongedocumenteerde | 5× IconBtn, 2× FIELD_TYPES, 2 CRUD-hooks vs exact 1× missed-filter/round2/sortChronological |
| Concurrent-prijzen | createimpacts.eu/pricing live gefetcht 09-09; TradeZella/TraderSync/Edgewonk/Tradervue via bronnen in het business-deelrapport |

### Adversariële verificatie — wat gesneuveld of genuanceerd is

- **"f6b7617 schendt de gating-regel"** (product-deelaudit) → genuanceerd: het live-zetten van Habits/Dagboek voor alle leden was blijkens het sessie-geheugen een bewuste owner-beslissing. De bevinding wordt: *regelwijziging zonder documentatie* (CLAUDE.md kent de regel én de features niet meer) — nog steeds een probleem, maar een ander.
- **"Audit-fixes gebeuren niet"** → genuanceerd: de landing-sessie fixte haar auditpunten wél (69a681a); het probleem is dat niets integreert. H4 (SEO) uit de 03-09-audit is op de branch feitelijk opgelost.
- **"8 vs 11 commits achter"** → beide juist: HEAD..origin/main = 8, main..origin/main = 11 (verschillende basis).
- **CrossTable-claim** → zelf herlezen: de timing-tak (r67-68) mist inderdaad de rij-exclusie die de fallback-tak (r70-71) wél heeft; het degenerate geval vergt dat sessie de éérste data-dragende dimensie is — correct gescoped door de deel-audit.
- Alle overige steekproeven (doodlopend spoor, owner-e-mail, schema-FK's, plan-grep, robots/sitemap) hielden integraal stand.

### Niet verifieerbaar vanuit de repo — checklist voor de owner (Supabase/Vercel-dashboard, ~15 min)

1. Supabase-tier (free of Pro?) en backup-status → bepaalt de urgentie van punt 2 in Laag 5.
2. Zijn 0053–0056 daadwerkelijk op prod gedraaid? (WAARSCHIJNLIJK wel — features draaien — maar registreer het.)
3. Auth → wachtwoordminimum (server-side ≥8?) + leaked-password-protection aan?
4. Supabase-projectregio = EU? (Privacy-policy claimt het.)
5. `VITE_SENTRY_DSN` op Vercel gezet? Komen er events binnen?
6. SMTP/e-mailtemplates voor signup-bevestiging klaar? (Spam-folder-risico.)
7. DPA's Supabase/Vercel/Sentry/Cloudflare afgevinkt en bewaard?

### Zekerheid van het totaaloordeel

**Hoog** op alles wat code, git en configuratie is — dat is zelf gelezen, gedraaid of gereproduceerd, en de zwaarste claims zijn in een tweede ronde adversarieel herverifieerd. **Middel** op de business-modellering (prijselasticiteit, conversie, marktomvang NL/BE zijn ordegrootte-schattingen — gelabeld VERMOEDEN) en op de persona-gewichten (welk afhaakmechanisme domineert is niet meetbaar zonder analytics — precies het punt). **Laag** op alles achter het Supabase-dashboard (checklist hierboven). Wat de zekerheid het meest zou verhogen: (1) de dashboard-checklist afvinken, (2) analytics + 30 dagen echte beta-gebruikers — geen audit kan vervangen wat vijf echte traders je in twee weken vertellen.

---

## Begin hier

Eén stap, vandaag of morgen, geen beslissingen nodig: **doe de schoonmaak-sessie** — rebase deze branch op origin/main, los het Sidebar/router-conflict op, dicht de drie un-gate-gaten (advies: Settings + switcher mee un-gaten), merge de landing, werk CLAUDE.md bij. Aan het eind van die ene dag bestaat er weer precies één werkelijkheid: main = prod = docs = jouw hoofd. Dat is het moment waarop de soep ophoudt soep te zijn — en alles wat daarna komt (vangrails, jurist-uur, launchweek) is een kort, eindig lijstje in plaats van een berg. Het product is beter dan het voelt; het wacht alleen op afronding.
