# Fase M + N — startdocument (voor nieuwe sessie, model: **Fable**)

> Geschreven 2026-08-19 na afronding van Fase K + L (screenshots + PWA/quick-log).
> Model-afspraak (memory `beyen_model_per_fase`): **M → Fable** (share-links raken
> RLS/security + een migratie → Fable-terrein), **N = gemengd** (per stuk kiezen;
> stats/migratie-stukken → Fable, UI-stukken → Opus). Vuistregel owner:
> stats-motor / migraties / security → Fable.

## Uitgangsstand (belangrijk — lees eerst)

- **K + L zijn AF, getest door de owner en gecommit** op branch `fase-k-screenshots`
  (HEAD = `cb9a547`, werkboom schoon, lint+test+build clean):
  - `618eaf8` Fase K (screenshot-upload, migratie `0039` = private bucket, al
    gedraaid + read-only geverifieerd op prod).
  - `c6bb2cb` Fase L (PWA beta-only service worker + quick-log).
  - `04f1f34` … `cb9a547` = L-polish: theme-color-meta weg (niet-beta browsing
    ongewijzigd) + quick-log-knop compact/uitgelijnd in de header.
  - **Nog NIET gepusht/gemerged naar `main`.** Doet de owner expliciet.
  - ⚠️ **Begin M pas nadat K/L op `main` staat** (branch M vanaf `main`), óf branch
    M vanaf `fase-k-screenshots` als merge nog niet gebeurd is — anders mis je K/L.
- Werkboom bij schrijven: schoon. Eerstvolgende vrije migratienummer: **`0040`**.
- Openstaande kleine restjes uit K/L (blokkeren M/N niet): definitieve PWA-iconen
  (designer; nu placeholders in `public/pwa-*`), mobiel-viewport-check van geraakte
  schermen (stappenplan L-item 3), K-items PDF-embedding + vrije screenshot-lijst
  (bewust uitgesteld, zie `docs/fase-K-L-handoff.md`). `npm audit`: 3 vulns
  (nanoid/react-router) = pre-existing, niet aanraken.

## Werkafspraken (kort — CLAUDE.md is leidend)

- **Alles nieuws achter de beta-gate**: `useAuth().betaFeatures`. Zie hieronder de
  nuance voor M (een anonieme coach heeft geen account → alleen het *maken/beheren*
  van share-links gate je op beta; de *token-view* zelf is per-token, niet per-user).
- **Migraties draait de owner zelf** in de Supabase SQL-editor (één genummerd,
  idempotent bestand; expliciete grants/revokes zoals `0038`/`0039` — anon krijgt
  standaard EXECUTE op nieuwe functions, dus **revoke anon by name**). Jij verifieert
  daarna read-only (pg via `SUPABASE_DB_URL` in `.env.local`, script-patroon:
  `node --input-type=module` vanuit projectdir zodat `pg` resolvet).
- Branch per fase, commit alleen op expliciete vraag, `npm run lint` + `test` +
  `build` clean vóór "klaar". **Gedeelde worktree**: nooit `git add -A`, alleen
  eigen bestanden expliciet stagen (parallelle chat draait in
  `.claude/worktrees/…` op een eigen branch).
- Missed trades nooit in echte stats (`src/lib/stats/core.ts`). `TradesApi` = één
  gedeelde instantie per pagina.

## Fase M — Coaching & sharing (1-2 sessies) — **Fable**

**Doel:** de owner kan een coach een link sturen die **zonder account** het journal
(of een review) **read-only** toont. Voorbij de bestaande PDF-export.

**Klaar wanneer:** een token-URL opent het journal read-only voor een niet-ingelogde
bezoeker, RLS-veilig (geen andere data lekt, token intrekbaar).

### Ontwerprichting (te bevestigen in de sessie)
1. **Migratie `0040`**: tabel `share_links` (`id`, `token` (random, uniek, geïndexeerd),
   `user_id`, `methodology_id` nullable (welk journal), `scope` ('journal' | 'review'),
   `review_id` nullable, `expires_at` nullable, `revoked` bool, `created_at`).
   RLS: owner beheert eigen rijen (`user_id = auth.uid()`).
2. **Anon leest via token, niet via de gewone tabellen.** Gewone `trades`-RLS is
   `user_id = auth.uid()` — een anonieme coach matcht dat nooit. Twee veilige opties:
   - **SECURITY DEFINER RPC** `get_shared_journal(token text)` die het token valideert
     (bestaat, niet revoked, niet verlopen) en alleen de trades/aggregaten van dat
     `user_id`+`methodology_id` teruggeeft. `grant execute … to anon` (bewust!), body
     filtert strak. Geen directe tabeltoegang voor anon. **Voorkeur** (kleinste
     RLS-oppervlak, expliciet).
   - Alternatief: een RLS-policy op `trades` die anon toelaat als er een geldig
     token bestaat dat naar die rij-owner wijst — breder oppervlak, foutgevoeliger.
     Alleen als de RPC te beperkend blijkt.
3. **Publieke read-only route** (bv. `/share/:token`), buiten de auth-gate in
   `src/router.tsx` (zoals `/terms`, `/privacy`). Hergebruik de bestaande read-only
   weergaven (`ReadOnlyTradeDetailModal` bestaat al; de journal-KPI's/curves komen uit
   `src/lib/stats/`). Géén edit-acties, géén TradeForm, géén import/quick-log.
4. **Beheer-UI** (gate op `betaFeatures`): "Deel"-knop op journal/review → maakt token,
   toont kopieerbare URL, lijst met intrekken/verlopen. Klein.
5. **Privacy**: token = capability (wie de link heeft, ziet het). Default géén
   `expires_at`? Overweeg standaard verval + expliciet intrekken. Toon in de UI dat
   de link ongeauthenticeerd toegang geeft. Zet nooit PII in de URL behalve het token.
6. **Let op de CSP** (`vercel.json`) en dat de share-view géén auth-only calls doet
   (anon-sessie). Turnstile/CAPTCHA staat nu uit (CLAUDE.md) — niet nodig voor de view.

**Later/optioneel (niet dit stuk):** geverifieerde publieke track-record-pagina
(Myfxbook-idee, methodiek-bewust).

## Fase N — Methodiek-verdieping (doorlopend, per stuk 1 sessie) — **gemengd**

Losse, onafhankelijke bouwstenen; kies er per sessie één. Modelkeuze per stuk.
1. **Meer presets** (ICT/SMC, breakout, mean-reversion, opties-wheel, …):
   `docs/journal-presets.md` uitbreiden + seeds. Patroon = bestaande presets
   (`0027`/`0028`, `PresetPicker`). UI-licht → Opus of Fable.
2. **Regel-adherentie-analyse**: "wat kost afwijken van je eigen condities?" — koppel
   `trade_evaluation` (Emotional/Technical error) + veld-waarde-combinaties aan
   P&L-verschil. Stats-motor (`src/lib/stats/`) → **Fable**.
3. **MAE/MFE** (zodra import loopt — Fase I): twee optionele kolommen (handmatig of uit
   CSV) + exit-analyse-rapport. Migratie + stats → **Fable**.
4. **Onboarding-wizard** (longlist-memory `beyen_onboarding_flow_deferred`): first-run
   naam + timezone + preset-keuze; hergebruikt de preset-picker. UI → Opus.
5. **Review-secties configureerbaar per journal** (Fase F "later"-variant, zelfde
   patroon als `methodology_fields`). Migratie + UI → gemengd.

## Volgorde-advies

M eerst (afgebakend, één migratie, hoge coaching-waarde), dan N-stukken los. Elke
fase zelfstandig deploybaar. Na afronding: `/code-review` over de branch vóór merge
(ving bij K 2 echte fouten, bij J 14).
