# Fase Q — startdoc (handoff van de audit-sessie, 2026-08-20)

> **Leidend plan:** `docs/masterplan-2026-08.md` (volgorde Q→R→G→S1→LAUNCH→I→S2→N-rest→O→P). **Alle bevindingen in detail:** `docs/audit-en-launchplan-2026-08.md` (ronde 1 + 2). Dit doc is alleen wat je nodig hebt om Fase Q te bouwen.
> **Model: Fable — VERPLICHT.** Controleer bij sessie-start welk model je bent (staat in je system prompt). Ben je geen Fable: bouw niet, meld het de owner en vraag om een nieuwe sessie op Fable. Zie de bindende modelverdeling in `masterplan-2026-08.md`.

## Wat Fase Q is

De vijf launch-blokkers uit de audit. Geen launch en géén externe testers vóór deze fase af is.

| # | Blokker | Kern |
|---|---|---|
| K1 | Privilege escalation | `profiles`-UPDATE-policy beperkt geen kolommen → self-service `role='admin'` = alle data van iedereen lezen |
| H1 | 1.000-rijen-afkap | Fetches zonder `.range()` → PostgREST kapt stil af; stats fout boven 1.000 trades |
| N1 | Profiel-foutpad | `fetchProfile`-fout is "non-fatal" → app rendert zonder `methodology_id`; trades kunnen stil in WPM-template of `null`-journal belanden |
| N2 | GDPR/storage | `delete_own_account()` wist geen Storage-screenshots; nergens in de code bestaat een storage-delete |
| N3 | Review-relink | Weekreview naar andere week/jaar bewerken herkoppelt de trades niet (triggers zijn insert-only) |

## Sessie 1 — migratie 0044 (K1 + N1-DB + N2-DB in één)

**Let op: 0043 is geclaimd door de open-trades-chat.** Dit wordt dus `0044_audit_hardening.sql`. Inhoud:

1. **K1:**
```sql
revoke update on profiles from authenticated;
grant update (display_name, hide_fase, timezone, methodology_id, result_unit, onboarded_at)
  on profiles to authenticated;
```
   (Check vóór het schrijven of de open-trades-migratie/latere migraties géén extra door-de-user-schrijfbare profielkolom hebben toegevoegd — dan hoort die in de grant-lijst.)
2. **N1-DB:** ownership-check dat `trades.methodology_id` naar een eigen, niet-`is_system` methodology wijst (trigger of FK-vervangende check — `schema.sql` rond r.485 heeft nu niets).
3. **N2-DB:** in `delete_own_account()` vóór de user-delete:
```sql
delete from storage.objects
where bucket_id = 'screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text;
```

Werkwijze zoals altijd: migratiebestand schrijven → owner draait via `scripts/run-migration.mjs` + `SUPabase_DB_URL` → read-only verifiëren. **Verificatie K1:** als niet-admin `update profiles set role='admin'` → moet falen; de zes whitelist-kolommen moeten wél updaten. Vergeet `supabase/schema.sql` niet bij te werken (maar zie de coördinatie-waarschuwing hieronder: schema.sql is mogelijk al aangeraakt door de open-trades-chat — pas aan bovenop hún versie, overschrijf niets).

## Sessie 1/2 — client-kant

- **H1:** gepagineerde fetch-helper (`.range(from, to)`-lus tot pagina < 1000) in `useTrades.refresh()`, de `import_ref`-fetch in `ImportModal.tsx`, en dezelfde helper voor `useWeeklyReviews`/`usePropAccounts`/admin-queries.
- **N1-client:** profielfout blokkerend maken in `useAuth.tsx` (retry-scherm i.p.v. doorrenderen; comment "non-fatal — only role gating" is achterhaald); mutaties weigeren zolang `profile == null`; `TradeForm.tsx` (r.~183) nooit laten terugvallen op een `is_system`-methodology-id. **⚠️ TradeForm wordt mogelijk ook door de open-trades-branch aangeraakt — coördineer/rebase.**
- **N3:** in de review-edit-flow (`ReviewsPage.tsx` handleSubmit → `useWeeklyReviews.updateReview`) bij gewijzigde `jaar`/`week_nummer` automatisch `linkTradesToReview` aanroepen (bestaat al, is idempotent).
- **N2-lifecycle (mag ook naar R):** screenshot-storage-delete bij trade-delete/vervanging, of een orphan-sweep.

## Stand bij overdracht (geverifieerd 2026-08-20 ~21:00)

- **Open posities is AF en live op main+prod** (migratie 0043 gedraaid; niet beta-gated — bewuste owner-keuze). De audit-bevindingen N7 (DB-check `is_open`+evaluatie) en N8 (switcher-teller) zijn dáár al meegenomen — geverifieerd in `0043_open_trades.sql:47` en `useJournals.ts:77-82`. **Niets van doen in Q.**
- **Worktree schoon** (alleen de drie audit/plan-docs untracked, nog niet gecommit), lokale `main` = `origin/main` (69251df). **tsc groen, 242 tests groen** — je kunt direct branchen vanaf main.
- Let op bij het schrijven van 0044: 0043 heeft `get_shared_journal`/review-RPC's ge-`create or replace`d — jouw migratie raakt die niet, maar check bij twijfel altijd de laatste definitie op main, niet een oudere migratie (merge-gotcha-les uit de open-trades-chat).
- **Gedeelde-worktree-regels blijven gelden:** nooit `git add -A`, alleen eigen bestanden stagen; eigen branch voor Fase Q.
- **Repo-restje voor R (niet Q):** `0036_revoke_anon_execute.sql` staat alleen op branch `claude/jolly-cannon-8d47fc` (wél op prod gedraaid) → cherry-pick naar main.

## Klaar wanneer

Self-update van `role`/`beta_features`/`plan` faalt; stats kloppen bij >1.000 trades (test met een gemockte grote set of verifieer de lus-logica met een unit-test); een geforceerde profiel-fetch-fout toont een retry-scherm en laat géén trade-save toe; account-delete wist de screenshots-map; een review-week-edit toont direct de juiste trades. Lint/test/build groen, review met owner, commit op branch — push alleen op verzoek.
