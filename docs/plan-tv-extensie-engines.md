# Review + engineplan — Beyen TradingView-extensie

**Reviewer:** Fable (architect/review), 2026-09-15. **Input:** `docs/spec-tv-extensie-2026-09.md`, geverifieerd tegen de echte codebase (main @ 5008e00). **Status:** docs-only — geen code, geen migratie (feature-freeze). Dit doc is het startpunt voor de bouw ná de beta-launch; het vervangt de spec niet maar corrigeert 'm waar die van de code afwijkt.

---

## 1. Reviewoordeel

**Bouwbaar: ja — maar niet zoals beschreven.** De richting klopt (import-automatisering chart → journal, dynamische form uit het journal-schema, eigen sessie i.p.v. cookies delen, MV3, beta-gate). De filosofie-grens wordt gerespecteerd: er wordt geen chart, replay of koersdata gebouwd — de extensie leest wat de trader al in TradingView intekent en schrijft dat naar het bestaande journal. Dat is exact "TradingView is king, Beyen = analyse-laag erbovenop".

Maar de spec doet zeven architectuur-claims die niet stroken met de code, en mist twee dingen die het product bepalen (open trades; backtest-projecten). Hieronder de correcties op volgorde van impact.

### Top-correcties (met bestand:regel)

| # | Spec zegt | Code zegt | Gevolg |
|---|---|---|---|
| **C1** | §8: "hooguit een `trades.source`-kolom", verder geen migratie | `trades` heeft **geen** entry-/SL-/TP-prijskolommen — alleen `planned_rr`, `risk_pct`, `resultaat_pct`, `mae_pct/mfe_pct` (`supabase/schema.sql:265-276`). De kernwaarde van de extensie (auto-fill entry/SL/TP) kan nergens landen. | **Migratie nodig** (`entry_price`, `stop_price`, `target_price`, evt. `exit_price`, numeric). Alleen `planned_rr` afleiden en de prijzen weggooien is dataverlies en maakt de latere "gepland vs. gerealiseerd R"-analyse onmogelijk. `trades.source` zelf is overbodig — zie C6. |
| **C2** | §3.2: koppeltoken → "eigen Supabase-sessie via PKCE (`signInWithOtp`/token-exchange)" | Er bestaat geen Supabase-flow die een koppelcode omruilt voor een sessie op een ander apparaat. PKCE is een redirect-flow voor OAuth/magic-link, niet voor code-exchange. De web-client is `createClient(url, anonKey)` zonder auth-opties (`src/lib/supabase.ts:25`). | Twee wél bestaande mechanismen (zie §2.2): **(A)** app-side serverless functie met service-role → `auth.admin.generateLink({type:'magiclink'})` → extensie `verifyOtp({token_hash, type:'magiclink'})`; **(B)** e-mail-OTP rechtstreeks in de extensie. **A is de aanbeveling**: het geeft precies de "klik Verbind in de app"-UX én omzeilt de CAPTCHA die in launch-week (G2) weer aan gaat — B loopt daar tegenaan. |
| **C3** | §4: gate op `useAuth().betaFeatures` = "flag OR admin OR owner-email" (ook CLAUDE.md) | `betaFeatures = profile.beta_features || role === 'admin'` — de owner-email-hardcode is verwijderd (fixplan C6), `src/hooks/useAuth.tsx:199-202`. De extensie heeft geen `useAuth`; ze moet `profiles` zelf lezen (RLS `profiles_owner_select`, `schema.sql:1735`). | Extensie evalueert `beta_features || role==='admin'` zelf. Let op: dit is een **client-side** weigering, geen harde server-gate — er is geen RLS-policy die een trade-insert aan `beta_features` koppelt. Acceptabel voor "netjes weigeren", niet als beveiliging verkopen. CLAUDE.md-zin over owner-email is stale → bij de volgende docs-update corrigeren. |
| **C4** | §3.4: "per gekozen timeframe: capture → upload → koppel zoals de app dat doet" | Screenshots zijn **vier vaste kolommen**: `w_/d_/h4_/h2_screenshot` (`schema.sql:299-302`, `src/lib/storage/screenshots.ts:58`). Geen tabel voor n snapshots per trade. | Snapshots = precies de slots W / D / 4H / 2H, niet "gekozen timeframes". Voldoende voor de WPM-workflow; een vrije TF-set vergt een extra `trade_screenshots`-tabel (niet aanbevolen voor v1). |
| **C5** | §3.4: `<canvas>.toDataURL()` als primaire capture, CORS-taint als risico | TV rendert de chart op **meerdere gestapelde canvassen** (pane, prijsas, tijdas, overlay). Eén `toDataURL` geeft een deel van het beeld; compositing is fragiel. CORS-taint is hier niet het echte probleem. | Primair `chrome.tabs.captureVisibleTab` (permission `activeTab`, geen `<all_urls>`) + croppen op de chart-container-rect. Robuust, bevat alle tekeningen, geen canvas-gefrunnik. TV-snapshot-link (`tradingview.com/x/…`) als tweede optie — die wordt door de app al als externe URL opgeslagen zonder wijziging (`screenshotPath.ts:11-18`). |
| **C6** | §3.5: `source='tv-extension'` + "client-side UUID + upsert" | Idempotentie bestaat al: `trades.import_ref` + partial unique index `trades_user_import_ref_unique (user_id, import_ref)` (`schema.sql:328`, `:754`). | `import_ref = 'tv-ext:<client-uuid>'` geeft idempotentie **én** herkomst (prefix) zonder migratie. Geen `source`-kolom. `import_ref` wordt al buiten share-links gehouden (`src/lib/types.ts:498`). Upsert is niet nodig — insert + unieke-index-fout = "al gelogd". |
| **C7** | §3.3: "TV's `widget`-postMessage of de tekentool-DOM" | Er is geen postMessage-API op tradingview.com. De position-tool-labels staan **op canvas**, niet in de DOM — DOM-scraping van entry/SL/TP is kansloos. | De realistische bron is `window.TradingViewApi` in de **page-world** (MV3 content script met `world: "MAIN"`), dat de publiek gedocumenteerde Charting-Library-API spiegelt (`activeChart().symbol()/resolution()/getAllShapes()/getShapeById(id).getPoints()/getProperties()`). Ongedocumenteerd voor de website → **spike S0 moet dit eerst bewijzen.** DOM/URL alleen als fallback voor symbol + TF. |
| **C8** | §3.3: pips + R:R uit "instrument-metadata (pip-size per symbool)" in "onze bestaande stats-laag" | Er is geen per-symbool-registry. `pipSizeOf()` (`src/lib/lotSize.ts:66-69`) kent alleen JPY-vs-rest voor de forex-`PAIRS`-enum (geen XAU, indices, crypto). `instrument_config.tick_values` (migratie `0027:47`) is tick-*value* in $, geen tick-size. | R:R heeft géén metadata nodig (`|TP−entry| / |entry−SL|`). Pips wél — maar TV's symbolInfo levert `pricescale`/`minmov` (= tick-size) gratis mee via dezelfde API. Dus: pip/tick-size **uit TV** halen, niet zelf een tabel onderhouden; `pipSizeOf` alleen als forex-fallback. |

### Wat de spec mist (product-bepalend)

- **M1 — Open trades.** Vanaf de chart log je bij *entry*, dus zonder resultaat. Dat is de `is_open=true`-flow (migratie 0043; check `trades_open_result_chk`, `schema.sql:258-264`): outcome/resultaat/evaluatie/MAE/MFE moeten null zijn, `planned_rr` mag. De extensie logt dus een **open** trade; sluiten gebeurt in de app (of in een latere fase vanuit de chart). Archer logt post-hoc met Win/Loss — Beyen kan beide: *live-modus* (open) en *post-hoc/backtest-modus* (gesloten met resultaat, zoals quick-log). De UI moet die keuze expliciet maken.
- **M2 — Backtest-projecten.** De aanleiding is "~2u besparing per 100-backtest-project", maar de spec noemt `backtest_projects` niet. Een trade hoort óf bij het live journal (`methodology_id = profiles.methodology_id`) óf bij één project (`backtest_project_id`, `schema.sql:324`; `useTrades.ts:126-129`). De extensie moet een **doel** kiezen (live journal / project X) en dat onthouden per TV-tab. In TV's replay-modus is dit de hoofd-use-case.
- **M3 — Verplichte legacy-kolommen.** `fase`, `pair`, `cc` zijn `not null` (`schema.sql:235,245,288`). De web-app vult stille defaults (`quickLogDefaults`, `src/lib/quickLog.ts:23-69`: eerste fase of "Fase 1", `pair 'EURUSD'`, `cc '11'`). De extensie moet **dezelfde** defaults sturen — anders faalt elke insert. Bovendien mag `methodology_id` nooit een system-template zijn (trigger `trg_trades_journal_ownership`, `schema.sql:739`).
- **M4 — Tijdzone.** `tijd_open`/`datum_open` zijn wall-clock in `profiles.timezone` (`schema.sql:237-241`); de sessie-trigger rekent daarmee. TV's bar-time is UTC (en de chart-tz-instelling is willekeurig). De extensie moet UTC → `profiles.timezone` converteren (Intl), anders klopt de sessie-breakdown niet.
- **M5 — Symbol-normalisatie.** `OANDA:NZDCHF` → `NZDCHF` in `PAIRS` (`constants.ts:69`) voor een forex-journal; voor andere journals → `instrument` (via `normalizeInstrument`, `src/lib/instruments.ts:20`) met `pair` op de verborgen default. Futures-continuous (`ES1!` → `ES`), crypto (`BINANCE:BTCUSDT`), CFD-suffixen — een pure parser met tests, nieuw werk.
- **M6 — Form-contract is groter dan "vijf types".** De extensie moet herimplementeren: 5 veldtypes, `show_when`-condities, `required`, `is_computed`-uitsluiting, het legacy-WPM-blok (`isLockedLegacyField`, `LEGACY_METHODOLOGY_FIELD_KEYS`) en de `label_key`-vertaling (`src/lib/methodologyFields.ts:39-96`, `CustomFieldsSection.tsx:725-739`). Dat mag **nooit** een tweede implementatie worden — zie §2.5 (gedeelde modules).
- **M7 — Launch-koppeling.** De spec zegt "niet in de freeze" — klopt voor de extensie zelf, maar F1 raakt de **web-app** (Settings-kaart + serverless functie). Dat is app-featurewerk en valt dus onder de freeze tot na de launch.
- **Scope-creep-waarschuwing:** Archer's rechterpaneel (watchlist + per-symbool-notes) is een apart product. Beyen heeft geen notes-per-symbool-tabel. Niet bouwen; buiten v1 houden.

---

## 2. Gecorrigeerde architectuur

### 2.1 Datamodel (één migratie, in F2)

- `trades.entry_price numeric(18,8)`, `stop_price`, `target_price` (nullable; `exit_price` optioneel voor de latere close-from-chart). Checks: alle null, óf entry+stop gevuld en `stop <> entry`; `direction` moet consistent zijn (long ⇒ stop < entry). `planned_rr` afleiden client-side en gewoon meesturen (bestaande kolom). `schema.sql` mee bijwerken; share-link-RPC's (`get_shared_journal/_review`, `schema.sql:1513-1560`) hebben een expliciete allow-list → de nieuwe kolommen bewust wel/niet meenemen.
- Herkomst + idempotentie: `import_ref = 'tv-ext:<uuid>'` (geen nieuwe kolom).
- Screenshots: bestaande bucket `screenshots`, pad `{uid}/{uuid}.png`, 5 MB, mime-whitelist (`screenshots.ts:24-25`, RLS `schema.sql:1683-1712`) → waarden in `w_/d_/h4_/h2_screenshot`.
- **Geen** `trade_screenshots`-tabel, **geen** `source`-kolom, **geen** notes-tabel.

### 2.2 Auth — "Verbind extensie"-flow (aanbevolen: variant A)

1. User is ingelogd op beyen.app → Settings → "Verbind TradingView-extensie" → knop roept `POST /api/extension-link` (Vercel-functie in `api/`, zoals `api/ff-calendar.ts` al doet) met de eigen JWT in de Authorization-header.
2. De functie verifieert de JWT tegen Supabase (`auth.getUser(jwt)`), checkt `beta_features || role='admin'`, en roept met de **service-role-key** (alleen server-side env, nooit in `VITE_*`) `auth.admin.generateLink({ type: 'magiclink', email })` aan. Ze geeft **alleen** `properties.hashed_token` terug — kortlevend, eenmalig, gebonden aan die user.
3. De app toont die token als koppelcode (of stuurt 'm via `externally_connectable` rechtstreeks naar de extensie — beide zonder mail).
4. De extensie (service worker) heeft een **eigen** supabase-client: `createClient(url, anonKey, { auth: { storage: chromeStorageAdapter, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } })` en doet `verifyOtp({ token_hash, type: 'magiclink' })` → eigen sessie met eigen refresh-token-familie.
5. Refresh: **niet** op `autoRefreshToken` vertrouwen (setInterval sterft met de MV3-service-worker) — `chrome.alarms` elke ~50 min → `getSession()` (refresht zelf bij verloop), plus refresh-on-demand vóór elke write.
6. Revoke: "Koppel los" = `signOut({ scope: 'local' })` in de extensie. Let op: de app's eigen `signOut()` is default **global** (`useAuth.tsx:143`) → uitloggen in de app trekt óók de extensie-sessie in. Bewuste keuze maken (waarschijnlijk oké en zelfs gewenst: "uitloggen = overal uit").
7. Alle data-calls lopen via PostgREST + RLS `user_id = auth.uid()` (`schema.sql:1804`) — de extensie krijgt exact de rechten van de user, niets meer. De service-role-key raakt nooit de extensie.

Waarom niet B (e-mail-OTP in de extensie-popup): werkt zonder backend, maar `signInWithOtp` valt onder Supabase's CAPTCHA-bescherming zodra G2 die aanzet — Turnstile in een extensie-popup is precies het soort ding dat eerder de Browser-pane sloopte. Variant A raakt de CAPTCHA niet (admin-API).

Waarom niet "sessie delen via externally_connectable": refresh-token-rotatie — twee clients op één refresh-token loggen elkaar uit. De spec heeft dit terecht afgewezen; alleen het alternatief klopte niet.

### 2.3 Chart-adapter (te bewijzen in S0)

- **Bridge:** content script in `world: "MAIN"` leest `window.TradingViewApi` en praat via `window.postMessage` met een strikt berichtenschema (type-gevalideerd, origin-check) naar het isolated-world content script, dat weer via `chrome.runtime` met de service worker praat. Dit is een security-grens: niets uit de page-world wordt vertrouwd zonder validatie.
- **Leest:** symbol + `symbolInfo` (pricescale/minmov → tick-size), resolution, alle shapes van type long/short position (entry/stop/target + tijd van punt 1), de laatste bar-time (replay-bewust).
- **Schrijft naar TV:** alleen `setResolution()` voor de snapshot-cyclus (W → D → 4H → 2H → terug). Niets anders — geen orders, geen tekeningen.
- **Degradatie:** elke lezer geeft `{ ok: true, value } | { ok: false, reason }`; het paneel toont "kon X niet lezen — vul handmatig in", nooit een lege/foute waarde. Leesfouten → Sentry (met TV-build-hash uit de pagina, zodat een TV-release herkenbaar is).
- **Isolatie:** één bestand `adapter/tradingview.ts` met alle API-paden en selectors; contract-tests tegen opgenomen fixtures van de `TradingViewApi`-responses.

### 2.4 Schrijfpad

Eén `buildTradePayload()` (gedeeld, pure) produceert exact wat `createTrade()` in `useTrades.ts:124-144` ook krijgt: `quickLogDefaults`-baseline + `methodology_id` (eigen journal of null) **óf** `backtest_project_id` + `import_ref` + prijzen + `direction` + `planned_rr` + `tijd_open`/`datum_open` in profiel-tz + `custom` (gepruned tot string|number|boolean, zoals `pruneCustom` in `TradeForm.tsx:128`) + `is_open` (live) of outcome/resultaat (post-hoc). Insert via PostgREST `trades` met `.select().single()`; unique-violation op `import_ref` = "al gelogd" (idempotent na retry). Validatie hergebruikt `tradeSchema` (`src/lib/validation.ts:35`) + `missingRequiredCustomFields`.

### 2.5 Repo-structuur: geen tweede implementatie

De extensie hoort in **dezelfde repo** (`extension/` naast `src/`), gebouwd met Vite (aparte config, MV3-target) en importeert de React-vrije domeinmodules rechtstreeks: `validation.ts`, `methodologyFields.ts`, `instruments.ts`, `quickLog.ts`, `constants.ts`, `stats/core.ts`, en de nieuwe `symbolNormalize.ts` / `priceMath.ts` / `tradePayload.ts`. Voorwaarde: die modules blijven vrij van `window`/React/supabase-imports (nu al zo, zie `screenshotPath.ts`-patroon). Winst: één waarheid voor defaults, validatie en veld-contract; één testsuite; één `npm run lint/test/build` die ook de extensie dekt. Nadeel: build-config-werk (F1b). Alternatief (aparte repo + gepubliceerd package) is voor een solo-owner meer onderhoud, niet minder.

### 2.6 Extensie-onderdelen (MV3)

- `manifest.json`: `host_permissions: ["https://*.tradingview.com/*"]`, `permissions: ["storage","alarms","activeTab"]`; **geen** `tabs`, geen `<all_urls>`, geen `scripting` tenzij S0 het nodig maakt. Supabase-origin hoeft geen host-permission (fetch vanuit de SW naar een CORS-origin werkt met de anon-key + JWT).
- `content/main-world.ts` (bridge), `content/panel.tsx` (shadow-DOM-paneel, eigen CSS, geen Tailwind-lek naar TV), `background/sw.ts` (auth, upload-queue, API), `popup/` (status + "koppel los" + link naar app).
- CSP van de extensie: default MV3 (geen remote code, geen eval). Geen externe scripts, ook geen Sentry-CDN — SDK bundelen.

---

## 3. Engineplan

Regel (bindend, `docs/masterplan-2026-08.md`): stats-motor / migraties / security → **Fable**; UI / polish → **Opus**. Grensgevallen zijn gemotiveerd. Eén sessie = één branch = één blok; max 1 open werkstroom.

| Blok | Inhoud | Engine | Waarom | Afhankelijk van | Omvang |
|---|---|---|---|---|---|
| **S0 — Spike** | Bewijs in een wegwerp-extensie (niet committen): (1) `window.TradingViewApi` bereikbaar via `world:"MAIN"` en levert symbol/resolution/position-shape-punten + symbolInfo; (2) `captureVisibleTab` + crop geeft bruikbare PNG ≤ 5 MB; (3) supabase-client met chrome.storage-adapter overleeft SW-slaap (alarms-refresh); (4) `verifyOtp(magiclink token_hash)` werkt vanuit een extensie. Output: `docs/spike-tv-extensie.md` met go/no-go per punt + welke API-vorm. | **Fable** | Technisch onderzoek met security-inslag (page-world-grens, sessie-opslag). Geen UI. | Ná launch-week (G). Geen app-code. | 1–2 dagen |
| **F1a — Koppel-endpoint** | `api/extension-link.ts`: JWT-verificatie, beta-check, `admin.generateLink(magiclink)` → `hashed_token`; rate-limit; service-role-key als Vercel-env; tests voor de guard-paden. | **Fable** | Security-kern (service-role, token-uitgifte). | S0 ✓ | 1 dag |
| **F1b — Extensie-skelet + auth** | `extension/`-map + Vite-MV3-build in de repo; manifest (minimale permissions); SW met eigen supabase-client, chrome.storage-adapter, alarms-refresh, `verifyOtp`-exchange, "koppel los"; beta-check via `profiles`; hello-world-paneel dat `methodologies`+`methodology_fields` van het actieve journal dumpt. Geen writes. | **Fable** | Auth/sessiebeheer + build-grens van de gedeelde modules (§2.5) = architectuur + security. | F1a | 1–2 dagen |
| **F1c — Settings-kaart "Verbind extensie"** | UI in Settings: knop → code/QR tonen, status "gekoppeld sinds …", "koppel los" (server-side sessie-revoke is optioneel), copy NL/EN, EmptyHint naar Gids. | **Opus** | Puur UI in de bestaande Settings-bouwstenen. | F1a (endpoint-contract) | ½ dag |
| **F2a — Chart-adapter** | `extension/adapter/tradingview.ts` + main-world-bridge met gevalideerd berichtenschema; lezers voor symbol/symbolInfo/resolution/position-shapes/bar-time; `setResolution` voor de snapshot-cyclus; degradatie-contract; fixtures + contract-tests; Sentry-telemetry op leesfouten. | **Fable** | **Grensgeval, gemotiveerd:** dit is geen UI maar een parser + een vertrouwensgrens (page-world → isolated → SW). Fouten hier corrumperen data stil (verkeerde SL = verkeerde R). Testbaarheid en isolatie wegen zwaarder dan het feit dat het "in de browser" leeft. | S0 | 2–3 dagen |
| **F2b — Domein-modules (gedeeld)** | In `src/lib/`: `symbolNormalize.ts` (TV-symbool → `pair`/`instrument`), `priceMath.ts` (R:R, pips uit tick-size, richting-consistentie), `tradePayload.ts` (`buildTradePayload` op `quickLogDefaults`-baseline, tz-conversie UTC → `profiles.timezone`, `import_ref`-vorm, open/post-hoc-modus). Volledige unit-tests. | **Fable** | Stats-motor-achtig: pure rekenlogica die in elke stat terugkomt. | — (parallel met F2a mogelijk, zelfde sessie of erna) | 1 dag |
| **F2c — Migratie prijzen** | Migratie *eerstvolgend vrij nummer* (nu 0058 — bij aanvang opnieuw checken in het fixplan): `entry_price/stop_price/target_price` (+ `exit_price`), checks, `schema.sql`, share-RPC-allow-list-beslissing, `Trade`/`TradeInput`-types, `tradeSchema`. Owner draait 'm (migratie-runner-werkwijze). | **Fable** | Migratie. | Vóór F2d gemerged | ½ dag |
| **F2d — Paneel-UI** | Shadow-DOM-paneel: doel-keuze (live journal / backtest-project), live/post-hoc-toggle, auto-fill-velden met "via TradingView"-badge en handmatige override, dynamische form uit `methodology_fields` (types, show_when, required, `label_key`-vertaling via het bestaande i18n-catalogus), legacy-WPM-blok als het journal legacy is, foutstaten ("kon X niet lezen"), "Log trade" → payload uit F2b → insert; succes-toast met link naar de trade in de app. | **Opus** | UI/UX; rekent zelf niets (alles uit F2a/F2b). | F2a, F2b, F2c | 2–3 dagen |
| **F3a — Snapshot-pipeline** | SW-kant: `captureVisibleTab` → crop op chart-rect → PNG/WebP ≤ 5 MB → upload naar `screenshots/{uid}/…` (hergebruik `uploadScreenshot`-contract) → paden in `w_/d_/h4_/h2_screenshot`; TF-cyclus via adapter met "terug naar oorspronkelijke TF"-garantie; queue met retry en opruimen van wees-uploads bij mislukte trade-insert (spiegel van `cleanupUnsavedUploads`, `TradeForm.tsx:186`). | **Fable** | Permissions, storage-RLS, upload-lifecycle. | F2d | 1–2 dagen |
| **F3b — Snapshot-UI** | Per slot (W/D/4H/2H): aan/uit, preview-thumbnail, "auto canvas" vs "TV-snapshot-link plakken", voortgang tijdens de TF-cyclus, hertry-knop. | **Opus** | UI. | F3a | ½–1 dag |
| **F4a — Hardening** | `security-review`-skill op het pakket; permissions/CSP-audit; berichtenschema-fuzz; rate-limits op het koppel-endpoint; Sentry-config; `npm run lint/test/build` dekt `extension/`; unlisted-Web-Store-pakket + privacy-policy-URL. | **Fable** | Security. | F3 | 1–2 dagen |
| **F4b — Polish + distributie-copy** | Popup-UI, onboarding in het paneel, Gids-pagina "TradingView-extensie", Settings-copy, Web-Store-listing-tekst + screenshots, Terms/Privacy-alinea over chart-setup + snapshots (owner/jurist bevestigt), NL/EN. | **Opus** | UI/copy. | F4a | 1 dag |
| **F5 (later)** | Close-from-chart (exit_price → resultaat via `risk_pct`), evaluatie-veld bij sluiten, edit van een eerder gelogde trade vanuit dezelfde chart. | Fable (rekenpad) + Opus (UI) | — | Na beta-feedback op F1–F4 | n.t.b. |

**Totaal bouw:** ~12–17 werkdagen exclusief Web-Store-reviewwachttijd en de spike-uitkomst. Realistisch als 6–8 sessies.

Per blok geldt "klaar = gemerged op main + docs/CLAUDE.md bijgewerkt + afgevinkt" — voor de extensie komt daar bij: **geladen in een echte Chrome met een echte TV-chart getest door de owner** (de Browser-pane is hiervoor ongeschikt: geen extensies, en TV+Turnstile-verleden).

---

## 4. Grootste risico's + open vragen (vóór de bouw beantwoorden)

1. **`TradingViewApi`-beschikbaarheid (S0, beslissend).** Als de page-world-API niet bereikbaar of te instabiel is, valt de auto-fill terug op "symbol + TF uit URL, prijzen handmatig" — dan is de moat een stuk kleiner en moet de owner beslissen of het nog de investering waard is. Go/no-go ná S0, niet ervoor.
2. **TV-DOM/API-drift.** TV deployt zonder changelog. Mitigatie: adapter-isolatie, fixtures, Sentry-alarm op leesfout-ratio, en een afspraak met jezelf: "adapter kapot = fix binnen een week, anders extensie tijdelijk op handmatige modus". Dit is de doorlopende onderhoudslast; bij een solo-owner is dat de echte prijs, niet de bouwdagen.
3. **TradingView ToS.** Automatisering/uitlezen van hun UI door een derde-partij-extensie is een grijs gebied. Vergelijkbare extensies bestaan al jaren, maar een TV-accountblokkade van de owner is een reëel (klein) risico. **Owner-beslissing + één keer de TV-terms lezen.**
4. **Web Store.** Ook een unlisted item gaat door review; developer-account ($5, identiteitsverificatie), privacy-policy-URL, "single purpose"-verantwoording, uitleg van elke permission. Reken op dagen tot weken en op één afwijzing. Nooit in launch-week plannen (klopt in de spec).
5. **Auth-flow-keuze (A vs B) — bevestigen.** A vereist een service-role-key op Vercel (nieuw soort secret in dit project; vandaag alleen anon-key + DB-URL in scripts). Dat is verdedigbaar maar moet bewust: minimale functie, rate-limit, alleen `generateLink` voor de aanroepende user zelf. B vereist geen secret maar botst met CAPTCHA (G2) en e-mail-templates. Aanbeveling A.
6. **Beta-gate is zacht.** Zie C3: de server dwingt `beta_features` niet af op inserts. Wil de owner dat hard, dan is een RLS-clausule of RPC nodig (extra migratie, Fable). Voor een beta-cohort van 10–30 is zacht voldoende.
7. **Snapshot-privacy.** Een `captureVisibleTab` van de hele tab bevat watchlist, accountnaam, eventueel broker-paneel. Croppen op de chart-container is verplicht, en de user moet een preview zien vóór upload. Ook: 4 × ~1 MB per trade — bucket-groei bij 100-backtest-projecten (0044 ruimt op bij account-delete, niet bij project-delete: `deleteTrade` ruimt wel per trade op, `useTrades.ts:172-180` — check of project-cascade dat ook doet; zo niet → wees-bestanden).
8. **Timezone-correctheid (M4).** Fout hier is onzichtbaar en vervuilt de sessie-breakdown structureel. Test met een user op `America/New_York` en een chart op UTC.
9. **Legacy-WPM vs. cyclus 10.** Het legacy-blok (fase/cc/entry/trade_concept als echte kolommen) staat op de post-launch-lijst om ge-de-hardcoded te worden (fixplan blok H). Bouw de extensie zó dat ze dat blok via `isLegacyFieldList` behandelt en niet zelf kolommen kent — anders moet cyclus 10 twee plekken raken.
10. **Replay-modus.** In TV-replay is "nu" de replay-tijd; de bar-time uit de shape-punten is dan wél juist, `Date.now()` niet. Nooit `Date.now()` als datum_open gebruiken.
11. **Wat als de user meerdere position-tools op de chart heeft?** Kies de meest recente of laat kiezen — UI-beslissing voor F2d, adapter moet de lijst geven.
12. **Werkelijke tijdwinst.** "~2u per 100 backtests" is een observatie bij Archer. Meet het bij de owner zelf in de eerste beta-weken met de bestaande quick-log als nulmeting, zodat de prioriteit t.o.v. CSV-import (blok H) op cijfers rust.

---

## 5. Aanbevolen volgorde t.o.v. de launch

1. **Nu t/m launch-week (blok G): niets.** Freeze respecteren; dit doc + de spec zijn de enige artefacten. Ook geen "even proberen"-spike in de repo.
2. **Direct na G (beta-observatieweken 1–2): S0-spike.** Kost 1–2 dagen, raakt de app niet, en beantwoordt de enige vraag die telt (risico 1). Parallel: owner leest TV-ToS (risico 3), maakt het Web-Store-developer-account aan (doorlooptijd) en beslist A/B (risico 5).
3. **Beslispunt** met de spike-uitkomst + de eerste beta-cijfers (activatie/W2 uit het launchplan). Twee scenario's:
   - *Spike groen én beta-retentie oké* → extensie wordt de eerste échte post-launch-feature, vóór de rest van blok H (behalve wat de beta acuut nodig heeft). Segment B ("systematische zelfbouwer, backtest in TradingView") uit het launchplan is exact de doelgroep — dit is het argument om 'm vóór CSV-import te zetten, mits de eerste echte CSV's niet eerder binnenkomen.
   - *Spike oranje/rood* → herscopen naar "symbol+TF+snapshot-hulp, prijzen handmatig" of parkeren; dan gaat blok H (CSV-import-validatie, share-links) voor.
4. **Bouwvolgorde:** F1a → F1b → F1c → F2b → F2c (migratie draaien) → F2a → F2d → F3a → F3b → F4a → F4b. Elke stap gemerged en owner-getest in echte Chrome vóór de volgende. Nooit twee blokken tegelijk open.
5. **Distributie:** unlisted Web-Store-link naar het beta-cohort (Discord `#aankondigingen`), pas publieke listing na ≥2 weken zonder adapter-breuk en na de security-review. Terms/Privacy-alinea moet vóór de eerste externe installatie live staan.
6. **Niet overhaasten, concreet:** de owner's eigen 100-backtest-workflow is de acceptatietest. Pas als de owner zelf een volledig project via de extensie heeft gelogd zonder handmatige correcties, is "perfect" bewezen — niet eerder delen.

---

## 6. Bouwlog (bijgewerkt 2026-09-16/17, nachtsessie Fable)

| Blok | Status | Waar |
|---|---|---|
| S0 spike | ✅ alle 4 GO, runtime owner-getest | `docs/spike-tv-extensie.md` |
| F1a koppel-endpoint | ✅ **live op prod** (smoke-test 401 = env OK) | `api/extension-link.ts`, main |
| F1b skelet + auth | ✅ live op main | `extension/`, main |
| F1c Settings-kaart | ✅ live op main (Opus) | `ExtensionLinkCard.tsx`, main |
| F2b domein-modules | ✅ live op main | `src/lib/{symbolNormalize,priceMath,tradePayload}.ts` |
| F2c migratie 0058 | ✅ code klaar — **⚠️ migratie moet op prod draaien VÓÓR de volgende main-push** | branch-lijn `tv-ext-f2c`+ |
| F2a chart-adapter | ✅ code klaar (bridge, parser, S0-contractfixture) | `extension/src/{adapter,content}` |
| F2d paneel | ✅ code klaar (prep Fable + UI Opus: shadow-DOM-paneel in beyen-thema, dynamische form incl. show_when, doel/modus, overrides met "via TradingView"-badges) | `extension/src/content/ui/` |
| F3a snapshots | ✅ code klaar (cyclus+crop+upload+herstel; activeTab-gebaar vereist) | `extension/src/snapshots.ts` |
| F3b snapshot-UI | ✅ code klaar (Opus: slots W/D/4H/Extra, link-plakken, wees-opruiming) | `content/ui/snapshotState.ts` e.o. |
| F4a hardening | ✅ protocol-fuzz + security-review gedraaid; fixes: **closed** shadow root (Medium-bevinding: open root = pagina kan paneel lezen/besturen), activeTab-permission hersteld, host-regex zonder lookalikes | b7b478c |
| F4b polish/Store | open (copy/EN, Web-Store-pakket + listing, privacy-alinea) | — |

**Owner-testchecklist (echte Chrome, ná migratie 0058 + main-push):** `npm run build:ext` → extensie herladen → Settings-kaart → koppelcode → popup "Verbind" → TV-chart met position-tool → paneel: chart lezen, doel/modus kiezen, custom velden, "Log trade" → trade verschijnt in de app (open trade in journal / gesloten in project) → snapshots: eerst één klik op het extensie-icoon (activeTab), dan "Maak snapshots" → paden op de trade.

Correctie op §2.2 t.o.v. de bouw: variant A draait live met een **`sb_secret`-key** (nieuwe key-stijl) als `SUPABASE_SECRET_KEY` op Vercel — functioneel gelijk aan de service-role-key uit het plan. En op §3/F2d: een backtest-trade draagt óók het actieve journal (zoals de web-form), het project komt er als `backtest_project_id` bovenop.

---

*Verificatiebronnen: `supabase/schema.sql` (trades 231-332, methodologies 384-424, RLS 1735-1854, storage 1664-1712, trigger 739/901), `src/hooks/useTrades.ts`, `src/hooks/useAuth.tsx`, `src/hooks/useMethodology.tsx`, `src/lib/{supabase,validation,quickLog,instruments,lotSize,methodologyFields}.ts`, `src/lib/storage/*`, `src/components/trades/TradeForm.tsx`, `api/ff-calendar.ts`, `vercel.json`, `docs/fixplan-2026-09.md`, `docs/launchplan-groei-2026-09.md`.*
