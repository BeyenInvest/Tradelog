// Fixplan blok B2: dagelijkse (of handmatige) database-backup via pg_dump.
//
// Usage:
//   node --env-file=.env.local scripts/backup-db.mjs
//
// Schrijft een timestamped custom-format dump (pg_dump -Fc) van de schema's
// `public` (alle app-data) en `auth` (de accounts) naar backups/, en ruimt
// dumps ouder dan de laatste 14 op. De dumps landen in `backups/` onder de
// huidige werkmap — draai het dus vanuit een map BUITEN de repo (de dumps
// bevatten auth-password-hashes). Owner-setup sinds 2026-09-25: Task Scheduler
// "Beyen backup" (dagelijks 21:00) → C:\Users\Beyen\BeyenBackups\run-backup.cmd.
//
// Vereist:
//   - SUPABASE_DB_URL in .env.local (zelfde als de migratie-runner).
//   - pg_dump op PATH, óf het volledige pad in env PG_DUMP.
//     Installatie (alleen client-tools nodig): https://www.postgresql.org/download/windows/
//     of `winget install PostgreSQL.PostgreSQL.17` (bevat pg_dump + pg_restore).
//
// Restore-oefening (fixplan B3, tegen een WEGWERP-project — nooit prod):
// Op 2026-09-25 geslaagd (rij-aantallen identiek aan prod) met dit recept:
//   1. Gratis Supabase-project; `psql "<wegwerp-URL>" -v ON_ERROR_STOP=1 -f supabase/schema.sql`.
//   2. pg_restore --dbname="<wegwerp-URL>" --data-only --no-owner \
//        --schema=auth --table=users backups/<file>.dump
//   3. pg_restore --data-only --no-owner --schema=public -f data.sql backups/<file>.dump
//      en data.sql in ÉÉN psql-transactie laden, voorafgegaan door:
//        begin; set local session_replication_role = replica;
//        -- truncate alle public-tabellen (cascade): schema.sql seedt zelf rijen
//        -- (templates, schema_migrations) die anders botsen
//      … data.sql … commit;
//      NB: --disable-triggers en PGOPTIONS werken NIET via de Supabase-pooler
//      (postgres is geen superuser) — vandaar de replica-rol in de sessie.
//   4. Vergelijk count(*) van auth.users/profiles/methodologies/trades met prod.
//
// NB: dit is het vangnet zolang het project op de free tier zit; het advies in
// het fixplan blijft Supabase Pro (7 dagen automatische backups) zodra er één
// echte beta-gebruiker met data is.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const KEEP = 14;

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set — run via: node --env-file=.env.local scripts/backup-db.mjs");
  process.exit(1);
}

const pgDump = process.env.PG_DUMP || "pg_dump";
try {
  execFileSync(pgDump, ["--version"], { stdio: "pipe" });
} catch {
  console.error(
    `Kan '${pgDump}' niet starten. Installeer de PostgreSQL client-tools ` +
      "(winget install PostgreSQL.PostgreSQL.17) of zet env PG_DUMP op het volledige pad naar pg_dump.exe.",
  );
  process.exit(1);
}

const dir = resolve(process.cwd(), "backups");
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16); // YYYY-MM-DD-HH-mm
const outFile = resolve(dir, `beyen-${stamp}.dump`);

console.log(`Dumping public + auth → ${outFile} …`);
execFileSync(
  pgDump,
  ["--format=custom", "--schema=public", "--schema=auth", "--no-owner", "--no-privileges", `--file=${outFile}`, connectionString],
  { stdio: "inherit" },
);
const size = statSync(outFile).size;
if (size < 10_000) {
  // Een lege/afgebroken dump is gevaarlijker dan geen dump: hij wekt de indruk
  // dat er een backup is. Hard falen zodat een cron-run zichtbaar rood wordt.
  console.error(`✗ Dump is verdacht klein (${size} bytes) — niet vertrouwen.`);
  process.exit(1);
}
console.log(`✓ Backup klaar (${(size / 1024 / 1024).toFixed(2)} MB).`);

// Rotatie: alleen eigen dumps in backups/ aanraken, nieuwste KEEP bewaren.
const dumps = readdirSync(dir)
  .filter((f) => /^beyen-.*\.dump$/.test(f))
  .sort()
  .reverse();
for (const old of dumps.slice(KEEP)) {
  unlinkSync(resolve(dir, old));
  console.log(`  opgeruimd: ${old}`);
}
