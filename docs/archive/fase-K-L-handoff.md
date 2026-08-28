# Fase K + L — startdocument (voor nieuwe sessie, model: Opus)

> Handoff geschreven 2026-08-19 na afronding van Fase J (incl. code-review-fixes,
> gemerged als `aa4b295` op main, live op prod). Werkboom was clean bij schrijven.
> Model-afspraak: K en L zijn "bekend patroon"-werk → **Opus**; raakt iets tóch de
> stats-motor, migraties of security/RLS → overleg/Fable (vuistregel van de owner).

## Werkafspraken (kort — details in CLAUDE.md, die is leidend)

- **Alles nieuws achter de beta-gate**: `useAuth().betaFeatures`. Geen uitzonderingen.
- **Migraties draait de owner zelf** via de Supabase SQL-editor (één genummerd
  bestand per wijziging, idempotent schrijven); jij verifieert daarna read-only.
  Laatste is `0038`; eerstvolgende vrije nummer is `0039`.
- Branch per fase (bv. `fase-k-screenshots`), commit alleen op expliciete vraag,
  `npm run lint` + `test` + `build` clean vóór "klaar".
- Missed trades nooit in echte stats (helpers in `src/lib/stats/core.ts`);
  `TradesApi` is één gedeelde instantie per pagina.

## Fase K — Screenshot-upload (1-2 sessies) — QoL-#1

Doel: Ctrl+V/upload van een chart-screenshot i.p.v. de vier URL-velden.
**Klaar wanneer:** Ctrl+V van een TradingView-chart in het trade-formulier werkt
en de screenshot toont in trade-detail én in de review-PDF.

1. **Supabase Storage-bucket** (`0039`): bucket `screenshots`, per-user RLS
   (pad-conventie `user_id/...`), size/mime-limieten. Let op het bestaande
   patroon: expliciete grants/revokes zoals in 0038 (anon niets).
2. **Upload + paste-from-clipboard** in het trade-formulier. Bestaande plekken:
   - `trades.*_screenshot` kolommen (W/D/H4/H2, `src/lib/types.ts:51-54`) zijn nu
     tekst-URL's, gerenderd via `UrlPreviewField.tsx` in
     `src/components/trades/TradeFormSections/TechnicalSection.tsx`.
   - Ook uitgelezen in `ReadOnlyTradeDetailModal.tsx` (admin) en de PDF-datalaag
     (`src/lib/pdf/reviewPdfData.ts`).
3. **Vrije screenshot-lijst** (cyclus 5-restje uit
   `docs/ontwerp-configureerbaar-journal.md`, regel 39/253): n screenshots met
   eigen label i.p.v. de vier vaste WPM-timeframe-slots. De vier bestaande
   kolommen blijven staan (legacy, droppen is Fase P/cyclus 10) — nieuw werk in
   een aparte tabel (bv. `trade_screenshots`: id, trade_id, user_id, label,
   storage_path, positie) of jsonb; kies additief, niets breken.
4. **Lightbox/preview** in trade-detail en review.
5. PDF: react-pdf kan afbeeldingen embedden; let op de CSP in `vercel.json`
   (zie memory: 'wasm-unsafe-eval' moet blijven) en op de Storage-URL-vorm
   (signed URL's vs public bucket — privacy: signed).

## Fase L — Mobile-instap: PWA + quick-log (1-2 sessies)

**Klaar wanneer:** de app is installeerbaar op een telefoon en een trade is in
<30 sec gelogd.

1. **PWA-manifest + service worker** (vite-plugin-pwa is de gebaande weg).
   Icon = gold shield: er zijn géén losse PNG's meer in `public/` (alleen
   `favicon.svg`); het merk leeft in `src/components/ui/Logo.tsx` — maskable
   PNG-iconen (192/512) moeten nog gegenereerd worden.
   Service worker conservatief houden: geen agressieve caching van Supabase-calls.
2. **Quick-log-formulier**: minimale velden (instrument, richting, resultaat,
   evaluatie) om direct na de sessie te loggen; details later aanvullen. Bedient
   ook de geparkeerde scalper-wens (quick-add). Hergebruik de bestaande
   TradeForm-secties/validatie (`tradeSchema`) — geen tweede waarheid bouwen;
   verplichte DB-velden krijgen dezelfde stille defaults als de import
   (`dealToImportRow` in `src/lib/import/mapToTrade.ts` is het voorbeeld:
   fase "Fase 1", cc "11", enz.).
3. Mobile-viewport nalopen van de geraakte schermen (de kalender heeft al een
   mobiel dot-patroon als voorbeeld).

## Status — Fase K (bijgewerkt 2026-08-19, branch `fase-k-screenshots`, nog niet gecommit)

Kern KLAAR (lint + 209 tests + build clean), achter `betaFeatures`-gate:

- **`0039_screenshots_bucket.sql`** — private bucket `screenshots`, 5 MB, png/jpg/webp/gif,
  per-user RLS (`{user_id}/…`, alleen `authenticated`, anon niets). **Owner moet 'm nog draaien**
  in de Supabase SQL-editor; tot dan faalt uploaden (UI werkt wel, tonen van bestaande URL's ook).
- **`src/lib/storage/`** — `screenshots.ts` (upload → pad, `resolveScreenshotUrl` → signed URL/
  passthrough) + `screenshotPath.ts` (pure `isStoragePath`/`toExternalUrl`, met tests). Kolommen
  ongewijzigd: waarde is óf externe URL óf bucket-pad; onderscheid op UUID-map-prefix, dus legacy
  (ook schemeless) URL's blijven werken.
- **`ScreenshotUploadField.tsx`** — Ctrl+V / drag-drop / bladeren + thumbnail + lightbox + verwijderen;
  URL-invoer blijft als fallback. Non-beta houdt de oude `UrlPreviewField` (nu met URL-placeholder,
  label zonder "(url)"). Gekozen in `TechnicalSection` op `betaFeatures`.
- **`ReadOnlyTradeDetailModal`** (admin) — opent screenshots via `resolveScreenshotUrl` (signt paden).

Bewust UITGESTELD (niet in deze sessie):

- **Review-PDF embedding (item 5).** De review-PDF is een *aggregaat*-dashboard met een compacte
  trade-tabel, én heeft een expliciet ontwerp-contract: "generation never depends on a network fetch"
  (fonts embedded, zie comment in `ReviewPdfDocument.tsx`). Remote screenshots embedden herintroduceert
  precies die fragiliteit (een mislukte fetch kan de hele export breken). Aanrader: apart vervolgstukje
  dat bytes downloadt + per-afbeelding graceful fallback, als bijlage-pagina — niet inline in de tabel.
- **Vrije screenshot-lijst / `trade_screenshots`-tabel (item 3).** Additief restje; de 4 vaste slots
  dekken "klaar wanneer" (form + trade-detail) al.
- **Orphan-cleanup.** Uploaden-dan-annuleren/vervangen laat een wees in de bucket (privé, per-user,
  ongevaarlijk). Bewust geen auto-delete om nooit een nog-gerefereerde afbeelding te wissen.

## Status — Fase L (bijgewerkt 2026-08-19, zelfde branch, nog niet gecommit)

Beide helften KLAAR (lint + 215 tests + build exit 0), achter `betaFeatures`:

- **Quick-log** — `QuickLogForm.tsx` (compacte modal: instrument · richting · resultaat% ·
  evaluatie), knop "Snel loggen" in de journal-header (beta + live journal only). `outcome`
  wordt afgeleid uit het teken van resultaat (`deriveOutcome`, zelfde als import — geen tweede
  waarheid), live als pill getoond. Rest = stille defaults via de pure `src/lib/quickLog.ts`
  (`quickLogDefaults` + `QUICK_EVALUATIONS` zonder "Missed trade"); test `quickLog.test.ts`
  bewijst dat defaults + resultaat een `tradeSchema`-valide trade vormen (regressie-guard).
  Verplichte custom-velden worden hier bewust overgeslagen ("nu loggen, later aanvullen").
- **PWA** — `vite-plugin-pwa` (devDep), manifest + `sw.js` + iconen gegenereerd bij build.
  Iconen = **placeholder** (goud merkteken op ink-vlak, `public/pwa-192/512` + `apple-touch-icon`,
  gemaakt met sharp die daarna weer verwijderd is) — vervangen zodra de designer levert.
  Service worker registreert **alleen voor beta-accounts** (`src/components/pwa/RegisterSW.tsx`,
  `injectRegister:null` + dynamische `virtual:pwa-register`-import) omdat een SW origin-brede,
  plakkende infra is. Conservatief: géén runtimeCaching voor Supabase (auth/data altijd netwerk);
  react-pdf-chunk (~1,4 MB) via `globIgnores` uit de precache (precache nu ~1,35 MB / 44 entries).
  index.html kreeg theme-color + apple-touch-icon + iOS-meta.
- **Niet echt te verifiëren hier**: installeerbaarheid/SW vereist een echt HTTPS-toestel; mijn
  sandbox-browser dwingt https af en kan de http-dev-server niet laden. Owner test op telefoon.
- **Openstaand**: mobiel-viewport nalopen van geraakte schermen (item 3) is licht/QoL, niet gedaan;
  definitieve PWA-iconen (designer); npm-audit meldt 3 vulns (nanoid/react-router) — **pre-existing**,
  niet door dit werk, bewust niet aangeraakt.

## Volgorde-advies binnen de sessie

K eerst (afgebakend, eigen migratie), dan L. Elke fase zelfstandig deploybaar.
Na afronding: `/code-review` over de branch (zoals bij Fase J — dat ving 14
echte fouten), dan pas mergen.
