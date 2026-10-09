# Plan — cTrader-koppeling (automatische trade-import)

**Owner-besluit 2026-10-08:** uitzondering op de feature-freeze — "tradingjournal kunnen verbinden met cTrader, trades automatisch in het journal". Branch `ctrader-sync`, migratie **0065**. Beta-gated (`betaFeatures`), zoals de CSV-import.

## 1. Wat het doet

1. Settings → **Koppel cTrader** → cTrader-login + "Allow access" (scope `accounts` = **alleen lezen**, Beyen kan nooit handelen).
2. Terug in Settings: per cTrader-account (live/demo) een **doel-journal** kiezen, **automatisch importeren** aan, optioneel **importeer vanaf**-datum (default 30 dagen terug).
3. Bij het openen van dat journal, daarna elke 2 minuten zolang het tabblad zichtbaar is, bij terugkeer naar het tabblad, en via de ↻-knop komen **gesloten posities** binnen als trades: datum + `tijd_open` (profiel-tijdzone), richting, instrument, exact resultaat-% (netto P&L incl. commissie/swap ÷ saldo vóór de sluiting), Win/Loss/BE. Nooit "Missed". Open posities wachten tot ze dicht zijn.
4. Onbekend symbool in een forex-journal (bv. US30) → statusbalk "wacht op symbool-koppeling" → **Koppelen** (bestaande import-wizard) of **Negeren**.

## 2. Architectuur

- **Server** (`api/ctrader.ts`, `api/ctrader-callback.ts`, `api/_lib/ctrader/*`): OAuth, token-opslag (AES-256-GCM, `BROKER_TOKEN_SECRET`), token-refresh (< 2 dagen resterend), cTrader Open API via **JSON over WebSocket** (`{live|demo}.ctraderapi.com:5036`). Deals per week-venster (API-limiet), max 26 weken per aanroep, 250 ms tussen historische requests. Eén trade = één positie (alle sluit-deals opgeteld); posities die vóór het venster openden krijgen hun volledige historiek via `DealListByPositionId`; nog-open posities (Reconcile) worden overgeslagen.
- **Client** (`src/lib/ctrader`, `useCtraderSync`, `CtraderSyncBar`, `CtraderConnectCard`): zet posities om naar `ParsedDeal` en gebruikt **exact de CSV-import-pipeline** (`prepareImport` → `createTradesBulk`, dedup op `import_ref = ctrader:<account>:<positie>`). De trades worden dus via RLS door de gebruiker zelf geschreven — de server schrijft nooit in `trades`.
- **Cursor** (`broker_accounts.synced_until`) schuift alleen op als een ronde volledig verwerkt is. Overlap is onschadelijk (dedup).
- **DB (0065):** `broker_connections` (tokens; géén grants voor app-rollen) + `broker_accounts` (leesbaar voor eigenaar; alleen `methodology_id/enabled/synced_until/last_synced_at` bij te werken; doel-journal-eigendom via trigger).

## 3. Security

- Tokens verlaten de server nooit; at rest versleuteld; scope alleen-lezen.
- Callback zonder JWT → HMAC-gesigneerde state (user + 10 min vervaltijd + nonce), timing-safe vergeleken. De nonce staat ook in een HttpOnly `__Host-`-cookie (SameSite=Lax) die `start` zet; de callback eist dat beide gelijk zijn en wist de cookie (security-review 2026-10-09: anders kon iemand zijn eigen koppel-link naar een slachtoffer sturen en diens cTrader-account onder zijn eigen Beyen-account binnenhalen).
- Elk endpoint: JWT-verificatie + beta-check + per-user rate-limit (12 syncs / 5 min) + `user_id`-filter op elke query.
- Fouten generiek naar de client, details alleen in server-logs.
- ⚠️ Model-per-fase: dit raakt auth/migratie/security (Fable-terrein) maar is op Opus gebouwd op expliciet owner-verzoek → **security-review door een Fable-sessie vóór merge** aanbevolen.

## 4. Bestanden

`supabase/migrations/0065_broker_connections.sql` (+ schema.sql) · `api/ctrader.ts` · `api/ctrader-callback.ts` · `api/_lib/ctrader/{protocol,positions,sync,secrets,config}.ts` · `src/lib/ctrader/index.ts` · `src/lib/import/pairMap.ts` · `src/hooks/useCtraderSync.ts` · `src/components/settings/CtraderConnectCard.tsx` · `src/components/trades/CtraderSyncBar.tsx` · tests: `api/ctrader.test.ts`, `api/_lib/ctrader/ctrader.test.ts`, `src/lib/ctrader/ctrader.test.ts`.

## 5. Owner-stappen (volgorde!)

1. **cTrader-app registreren:** <https://openapi.ctrader.com/apps> → inloggen met cTrader ID → *Add new app* → redirect URI **`https://www.beyen.app/api/ctrader-callback`**. Wachten op goedkeuring door Spotware (status "Active").
2. **Vercel env-vars** (Production): `CTRADER_CLIENT_ID`, `CTRADER_CLIENT_SECRET`, `CTRADER_REDIRECT_URI` = `https://www.beyen.app/api/ctrader-callback`, `BROKER_TOKEN_SECRET` = willekeurig ≥ 32 tekens (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`). `SUPABASE_URL` + `SUPABASE_SECRET_KEY` bestaan al. Node-versie van het Vercel-project ≥ 22 (globale `WebSocket`).
3. **Migratie 0065 op prod draaien** (migratie-eerst-dan-deploy) + de read-only verificatie onderaan het bestand.
4. **PR mergen** (CI groen).
5. **Testen:** Settings → Koppel cTrader → demo-account → journal kiezen → aan → importeer-vanaf een datum met trades → Journal openen → trades verschijnen; nog eens syncen → 0 nieuw (dedup).

## 6. Bewust (nog) niet

- Open/lopende posities live meeloggen (`is_open`) — v2.
- Server-side cron (sync zonder de app te openen) — Vercel Hobby = 1×/dag; v2 indien gewenst.
- SL/TP/entry/exit-prijzen en lot-size overnemen — v2 (velden bestaan sinds 0058).
- MetaTrader: heeft geen vergelijkbare publieke OAuth-API; blijft CSV/HTML-import.
