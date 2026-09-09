# Schema-sync werklijst — schema.sql ↔ migraties 0001..0052 (H2)

Reconstructie 2026-09-03. Bron: alle 53 bestanden in `supabase/migrations/` (let op: **twee** bestanden dragen nummer 0020) gediffed tegen `supabase/schema.sql` (1069 regels, working tree).

Methode: per objecttype de eindstand volgens "laatste definitie wint", daarna exhaustieve diff. Regelnummers schema.sql = huidige working tree.

---

## 0. WAT AL KLOPT (geverifieerd, geen actie)

Verrassend veel is al gesynct — de fix-sessie hoeft deze NIET aan te raken:

- **Enums**: alle 13 correct, incl. `trade_evaluation_enum` + 'Missed trade' (0002/0003), `period_type_enum` (0003), `prop_fase_enum` + 'Private' (0015), `direction_enum` (0029), `result_unit_enum` (0037); `entry_enum`/`trade_concept_enum` terecht afwezig (gedropt in 0010/0018, kolommen zijn text).
- **Kolommen**: trades volledig (incl. `tijd_open` 0051, `is_open` + beide checks 0043, `mae_pct/mfe_pct/planned_rr` + excursion-check 0049, `instrument` 0032, `direction` 0029, `import_ref` 0017, `risk_pct` 0012, `methodology_id`/`custom` 0020/0022); profiles volledig (role 0008, hide_fase 0009, timezone 0019, beta_features 0033, result_unit 0037, onboarded_at 0041, methodology_id zonder default = 0025-eindstand); weekly_reviews (verhalen 0021, methodology_id 0030, content 0048); prop_accounts (0011/0013/0015/0030); methodologies (asset_class/instrument_config 0022, track_exit 0050); methodology_fields (fase_id nullable + unique(methodology_id, field_key) = 0023, group_label/required/show_when_* 0022, label_key/group_key 0047); review_sections-tabel compleet (0048).
- **Functies met correcte eind-body**: `handle_new_user` (0035, 'Journal'), `delete_own_account` (0044, incl. storage-delete), `is_admin` (0008), `get_project_trade_summaries` (0043, incl. `not is_open`), `fork_methodology` (0048, incl. label_key/group_key + review_sections), `compute_sessie` (0019), `compute_sessie_at` (0051), `trades_set_sessie` (0051), `profiles_recompute_sessie` (0051), `link_weekly_review_to_trades` (0030), `enforce_trades_journal_ownership` + trigger (0044), `methodology_fields_clear_stale_keys` + trigger (0047), `set_updated_at`.
- **RLS**: alle owner-policies; alle 10 admin-select-policies mét `to authenticated` (0036/0046/0048-eindstand); K1-kolomgrant op profiles + `revoke all on table profiles from anon` (0044).
- **Indexes**: idx_*_methodology (0030), weekly_reviews_journal_week_unique + per-journal periodic-uniques (0030-eindstand, oude user-brede uniques terecht weg), trades_user_import_ref_unique (0017).
- **Seeds**: WPM-template in het flat fase-as-field-model (0023-eindstand), 10 presets (0027+0028) incl. crypto-show_when-update over alle 3 crypto-ids, WPM naam 'Weekly Phase Method' (0026).

---

## 1. WERKLIJST — één editeersessie, in deze volgorde

### W1 — ⚠️ NIEUW & BLOKKEREND: schema.sql faalt als fresh bootstrap door FK-volgorde
`weekly_reviews` (r81), `periodic_reviews` (r110) en `prop_accounts` (r245) hebben `methodology_id uuid references methodologies(id)` **inline in hun CREATE TABLE**, maar `methodologies` wordt pas op r289 aangemaakt. Een verse run stopt dus al op r76-98 met `relation "methodologies" does not exist` — vóór alle andere drift. (trades/profiles doen het wél goed: die krijgen methodology_id via ALTER ná de methodologies-creatie, r542-546.)
**Fix (kies één):** (a) verplaats het hele blok methodologies/methodology_fases/methodology_fields/review_sections vóór weekly_reviews, of (b) haal de inline kolom uit de drie CREATE TABLEs en voeg naast r542-546 drie ALTERs toe (mirror van 0030 r43-45) — optie (b) is de kleinste diff; de drie `idx_*_methodology`-indexes (r588-590) staan al ná de seeds, die kunnen blijven.

### W2 — `periodic_reviews.periode_overzicht` (0007, r12)
Ontbreekt in de CREATE TABLE (r106-125). Voeg toe onder `overall_comment` (r120): `periode_overzicht text,` met het 0007-commentaar (vrije sub-periode-recap). Zonder deze kolom faalt elke periodieke review-save én `get_shared_review` (die de kolom selecteert).

### W3 — Volledige share-laag (0040 + 0042 + 0043 + 0047 + 0048 + 0052)
Ontbreekt integraal. Toevoegen (logische plek: nieuw blok ná de link-triggers, vóór `-- RLS`, en de functies kunnen bij de andere functies):

1. **Tabel `share_links`** — 0040 r24-36 als basis, MAAR met de 0042-eindstand:
   - scope-check `check (scope in ('journal','review'))` (0042 r33-34, niet de 0040-versie met alleen 'journal');
   - kolommen `weekly_review_id uuid references weekly_reviews(id) on delete cascade` en `periodic_review_id uuid references periodic_reviews(id) on delete cascade` (0042 r36-39);
   - constraint `share_links_scope_refs_check` (0042 r44-49).
2. **Indexes**: `idx_share_links_user_methodology` (0040 r41), `idx_share_links_weekly_review` + `idx_share_links_periodic_review` (partieel, 0042 r54-57).
3. **RLS**: `alter table share_links enable row level security` (0040 r43) + policy `share_links_owner_all` in de **0042-versie** (0042 r67-93 — with check op methodology én beide review-FK's; niet de kortere 0040-versie) + `revoke all on table share_links from anon` (0040 r67).
4. **Functie `shared_trade_json(trades)`** — **0052-versie** (0052 r44-96; bevat `is_open` + `tijd_open` die 0042 nog niet had) + `revoke all ... from public, anon, authenticated` (0052 r98).
5. **Functie `shared_methodology_fields(uuid, uuid)`** — **0047-versie** (0047 r198-222; bevat label_key/group_key die 0042 nog niet had) + `revoke all ... from public, anon, authenticated` (0047 r224).
6. **Functie `shared_review_sections(uuid, uuid, text)`** — 0048 r143-163 + `revoke all ... from public, anon, authenticated` (0048 r165).
7. **Functie `get_shared_journal(text)`** — **0043-versie** (0043 r98-131; bevat `and not t.is_open` + het 'fields'-blok; 0043 is de laatste definitie — 0048/0052 raakten alleen get_shared_review) + `revoke execute ... from public; grant ... to anon, authenticated` (0043 r133-134).
8. **Functie `get_shared_review(text)`** — **0052-versie** (0052 r108-213; = 0048-body + `and not t.is_open` in BEIDE trades-subqueries) + `revoke execute ... from public; grant ... to anon, authenticated` (0052 r217-218).
   ⚠️ Neem de bindende conventie uit de 0052-kop over als commentaar: share-RPC's altijd hercreëren vanaf de láátste definitie (0048 hercreëerde vanaf 0042 en liet 0043's is_open-filter vallen → dat was het S2-1-lek).

### W4 — `link_trade_to_weekly_review`: 0052-versie i.p.v. 0030-versie
schema.sql r904-923 heeft de 0030-body (INSERT-only) en r925-927 de trigger `before insert on trades`. Vervang door 0052 r247-281 (INSERT respecteert expliciete koppeling; UPDATE her-resolvet bij echte wijziging van datum_open/methodology_id) en trigger 0052 r286-288: `before insert or update of datum_open, methodology_id on trades`. Zonder dit keert de M1-a-bug (trade naar andere week bewerkt → blijft aan oude review hangen) terug op verse installs.

### W5 — Functie `rename_field_option(uuid, text, text)` (0045 r31-99)
Ontbreekt volledig. Toevoegen incl. grants (0045 r102-104: revoke public + revoke anon + grant authenticated). Zonder deze RPC faalt optie-hernoemen in de veld-editor.

### W6 — Functie `create_journal(text, jsonb, text, jsonb, boolean, boolean)` (0052 r301-367)
Ontbreekt volledig. Toevoegen incl. grants (0052 r370-371). Zonder deze RPC is de journal-builder kapot (useJournalBuilder roept hem aan).

### W7 — Storage: `screenshots`-bucket + 4 policies (0039 r22-75)
Ontbreekt volledig: bucket-insert (on conflict do update; 5MB, image/png|jpeg|webp|gif, public=false) + de vier `screenshots_{select,insert,update,delete}_own`-policies op storage.objects (to authenticated, pad-segment = auth.uid()). Zonder bucket faalt élke screenshot-upload; `delete_own_account` (die schema.sql al in de 0044-versie heeft) verwijst er ook naar.

### W8 — Composiet-index `idx_trades_user_methodology_datum` (0052 r233-234)
`create index ... on trades(user_id, methodology_id, datum_open);` toevoegen aan het INDEXES-blok (r576-590). Hoofdleespad (journal-gescopeerde chronologische fetch).

### W9 — 0036-anon-revoke-conventie op functies
Op Supabase krijgt anon EXECUTE op elke nieuwe functie via default privileges; `from public` alleen is niet genoeg (geverifieerd tegen prod, zie 0016/0036). In schema.sql:
- r787: `revoke all on function delete_own_account() from public;` → `from public, anon;` (0036 r62)
- r801: idem `is_admin()` (0036 r59)
- r895: idem `fork_methodology(uuid)` (0036 r65 / 0047 r189)
- **`compute_sessie(cc_enum, date, text)`: helemaal géén revoke/grant in schema.sql** → toevoegen na r699: `revoke execute ... from public, anon; grant execute ... to authenticated;` (0036 r71-72)
- **`compute_sessie_at(date, time, text)`: idem niets** → zelfde paar (0052 r226-227)
(get_project_trade_summaries r842 heeft het al goed; de share-/rename-/create_journal-grants zitten in W3/W5/W6.)

### W10 — NIEUW: preset-seed mist de 0047 label_key/group_key-backfill
De preset-veld-seeds (r423-525) inserten `label_key`/`group_key` niet, terwijl 0047 (§3 r76-117, §4 r126-134) die op prod backfillde voor elk veld waarvan het label exact een catalogus-label is. Een verse install toont daardoor bevroren NL-labels in EN-context (share-view, preset-preview). **Kleinste fix:** kopieer de twee 0047-backfill-UPDATEs integraal ná de seed-blokken (ze zijn idempotent en raken alleen catalogus-matches). Alternatief: label_key/group_key in de VALUES opnemen — meer werk, zelfde resultaat.

### W11 — Header/conventie
De kop (r1-4, "run once, fresh project") klopt pas weer ná W1-W10. Voeg de H2-fix-conventie toe: elke migratie die een RPC/tabel/policy wijzigt werkt schema.sql in dezelfde commit bij. Overweeg ook de 0052-share-RPC-conventie (zie W3.8) als vast commentaar bij de share-functies.

---

## 2. Categorie (c): schema-only objecten (in geen enkele migratie)

Allemaal verklaarbaar als **oorspronkelijke bootstrap van vóór migratie 0001** (de migratieketen begon op een al-bestaande DB; 0001 verwijst al naar `trades` en `set_updated_at`):
- basis-enums (fase/outcome/pair/weekly_*/cc/sessie/structuur/prop_fase), basistabellen (trades-kern, prop_accounts-kern, payouts, weekly_reviews-kern), `set_updated_at` + updated_at-triggers, basis-indexes `idx_trades_user`, `idx_trades_datum_open`, `idx_trades_fase`, `idx_trades_pair`, `idx_trades_weekly_review`, `idx_payouts_account`.
Geen actie nodig — deze bestaan op prod via het originele bootstrap-pad en zijn semantisch consistent met de keten.

---

## 3. Functies met >1 definitie — monotonie-check

| Functie | Keten | Monotoon? |
|---|---|---|
| link_trade_to_weekly_review | base → 0004 → 0030 → 0052 | ✓ |
| link_weekly_review_to_trades | 0020_backfill → 0030 | ✓ |
| handle_new_user | 0005 → 0025 → 0035 | ✓ |
| delete_own_account | 0006 → 0044 | ✓ |
| get_project_trade_summaries | 0016 → 0043 | ✓ |
| compute_sessie / trades_set_sessie / profiles_recompute_sessie | 0019 → 0051 (compute_sessie ongewijzigd) | ✓ |
| fork_methodology | 0024 → 0047 → 0048 | ✓ |
| get_shared_journal | 0040 → 0042 → 0043 | ✓ |
| shared_methodology_fields | 0042 → 0047 | ✓ |
| shared_trade_json | 0042 → 0052 | ✓ |
| get_shared_review | 0042 → 0048 → 0052 | **✗ NIET monotoon**: 0048 hercreëerde vanaf de 0042-body en liet 0043's `and not t.is_open` vallen (het S2-1-lek); 0052 fixte het en maakte de vertrek-van-laatste-definitie-regel bindend. Eindstand = 0052 = correct. |

---

## 4. Nieuwe bevindingen (buiten de 8 bekende categorieën)

1. **[HOOG, schema.sql] Bootstrap-brekende FK-volgorde** — zie W1. schema.sql faalt op r76-98 nog vóór alle inhoudelijke drift; "fresh bootstrap = half-kapotte app" is feitelijk "bootstrap komt niet eens door de CREATE TABLEs".
2. **[MIDDEN, prod + schema] `review_sections.updated_at` wordt nooit bijgewerkt** — de tabel (0048) heeft een `updated_at`-kolom maar nergens (migratie noch schema.sql) bestaat `trg_review_sections_updated_at`. Elke edit laat updated_at op created_at-waarde staan. Kandidaat voor migratie 0053 (`create trigger trg_review_sections_updated_at before update on review_sections for each row execute function set_updated_at();`) + zelfde regel in schema.sql.
3. **[MIDDEN, schema.sql] Preset-seed zonder label_key/group_key** — zie W10; verse install ≠ prod voor de vertaallaag van presets.
4. **[LAAG, prod + schema] `create_journal` valideert `show_when_field_id` niet** — de RPC (0052) cast `p_fields[].show_when_field_id` rechtstreeks naar uuid; de FK eist alleen dat er érgens een methodology_fields-rij bestaat, niet dat die van de caller of van dit journal is. Een kwaadwillende authenticated user kan een veld laten verwijzen naar andermans veld-id. Geen data-lek (de waarde van dat veld wordt nooit teruggelezen), maar inconsistent met de eigendoms-checks elders. (Zelfde gat bestaat overigens in de directe client-insert-route via RLS.) Kandidaat 0053-hardening: show_when_field_id in de RPC remappen op field_key binnen p_fields, of een trigger-check.
5. **[LAAG, hygiëne] Twee migraties dragen nummer 0020** (`0020_backfill_trades_on_review_insert.sql` en `0020_configurable_methodology.sql`). Beide zijn gedraaid, geen conflict, maar het breekt de "laatste nummer wint"-aanname van tooling en mensen; hernummeren kan niet meer (gedraaid), dus documenteren in README/masterplan.
6. **[INFO] `share_links` heeft bewust géén admin_select-policy** — de enige user-datatabel zonder admin-carve-out. Lijkt een bewuste keuze (admin hoeft andermans share-tokens niet te zien — tokens zijn capabilities), maar is nergens gedocumenteerd; één regel commentaar in schema.sql voorkomt dat een latere sessie het als omissie "fixt" en daarmee tokens aan admins toont.
7. **[INFO] Owner-policies zonder TO-clausule** (trades_owner_all e.d., ook share_links_owner_all) gelden ook voor anon; veilig omdat `auth.uid()` daar null is en er geen functie-EXECUTE in de expressies zit (de les van 0036 geldt alleen voor is_admin()-policies, die wél `to authenticated` hebben). Bestaand patroon, consistent — geen actie.

---

## 5. Volgorde-advies voor de fix-sessie

1. W1 (herordening) eerst — daarna is de rest puur toevoegen/vervangen.
2. W2 (kolom), W4 (link-functie vervangen r904-927), W9 (grant-regels aanpassen) — kleine in-place edits.
3. W3, W5, W6, W7, W8, W10 — nieuwe blokken toevoegen (share-laag als één samenhangend blok).
4. W11 header + conventie-commentaar.
5. Verificatie: schema.sql in een wegwerp-Postgres (of `psql --single-transaction -f` tegen een lege lokale DB met een auth-schema-stub) draaien; minimaal een droge parse. Storage-statements (W7) vereisen een Supabase-omgeving — desnoods dat blok conditioneel documenteren.
6. Apart (niet in schema.sql-sessie): migratie 0053-kandidaten uit §4.2/§4.4 meenemen met de al geplande M3-items (fork_methodology + track_exit — NB: die bug raakt schema.sql óók zodra 0053 bestaat).
