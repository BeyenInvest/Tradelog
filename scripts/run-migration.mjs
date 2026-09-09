// Runs a single SQL migration file against the database in SUPABASE_DB_URL.
//
// Usage:
//   node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0057_registry_fork_track_exit.sql
//
// The whole file is executed inside one transaction: either every statement
// lands or none does. Migrations here are written to be idempotent/re-runnable
// (add-column-if-not-exists, drop-constraint-if-exists, create-or-replace).
//
// Registry (0057, fixplan C3): elke geslaagde run wordt in schema_migrations
// geregistreerd (zelfde transactie) en een bestand dat daar al in staat wordt
// GEWEIGERD — dubbel draaien is dan een bewuste keuze via FORCE_RERUN=1.
// Zolang de registry-tabel nog niet bestaat (pre-0057) slaat de check
// stilzwijgend over.
//
// TLS (fixplan C4): het servercertificaat wordt geverifieerd tegen de
// Supabase-CA. Download die één keer via Dashboard → Project Settings →
// Database → SSL Certificate en bewaar hem als supabase/prod-ca-2021.crt
// (of zet env SUPABASE_DB_CA op het pad). Zonder CA weigert de runner —
// ALLOW_INSECURE_DB_TLS=1 is de bewuste escape hatch (oude gedrag).
//
// Needs SUPABASE_DB_URL (the direct Postgres connection string, incl. password)
// in the loaded env — that's what `--env-file=.env.local` provides.
import { readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node --env-file=.env.local scripts/run-migration.mjs <path-to.sql>");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set — pass it via --env-file=.env.local (see README §Setup).");
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), file);
const sql = readFileSync(sqlPath, "utf8");
const filename = basename(sqlPath);

// A local Postgres over a plain socket needs no ssl; everything else verifies
// the server certificate against the Supabase CA (fixplan C4).
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
let ssl;
if (!isLocal) {
  const caPath = process.env.SUPABASE_DB_CA || resolve(process.cwd(), "supabase", "prod-ca-2021.crt");
  if (existsSync(caPath)) {
    ssl = { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  } else if (process.env.ALLOW_INSECURE_DB_TLS === "1") {
    console.warn("⚠️  Geen Supabase-CA gevonden — TLS zonder certificaatverificatie (ALLOW_INSECURE_DB_TLS=1).");
    ssl = { rejectUnauthorized: false };
  } else {
    console.error(
      "Geen Supabase-CA gevonden. Download 'm eenmalig: Supabase Dashboard → Project Settings →\n" +
        `Database → SSL Certificate, en bewaar als ${caPath}\n` +
        "(of zet SUPABASE_DB_CA op het pad). Bewuste omzeiling: ALLOW_INSECURE_DB_TLS=1.",
    );
    process.exit(1);
  }
}

const client = new pg.Client({ connectionString, ssl });

try {
  await client.connect();

  // Registry-check vóór de run. 42P01 = tabel bestaat nog niet (pre-0057) →
  // check overslaan; de registratie hieronder is dan ook een no-op.
  let hasRegistry = true;
  try {
    const { rows } = await client.query("select applied_at from schema_migrations where filename = $1", [filename]);
    if (rows.length > 0 && process.env.FORCE_RERUN !== "1") {
      console.error(`✗ ${filename} is al gedraaid op ${rows[0].applied_at.toISOString()} — geweigerd.`);
      console.error("  Bewust opnieuw draaien (migraties zijn idempotent): FORCE_RERUN=1 ervoor zetten.");
      process.exitCode = 1;
      await client.end();
      process.exit();
    }
  } catch (err) {
    if (err.code !== "42P01") throw err;
    hasRegistry = false;
  }

  console.log(`Running ${file} …`);
  await client.query("begin");
  await client.query(sql);
  // Zelfde transactie: de registratie hoort bij de run zelf. Savepoint: bestaat
  // de registry óók na deze run nog niet (een oude migratie draaien vóór 0057),
  // dan mag de mislukte insert de migratie zelf niet terugrollen.
  await client.query("savepoint reg");
  try {
    await client.query("insert into schema_migrations (filename) values ($1) on conflict (filename) do nothing", [
      filename,
    ]);
    hasRegistry = true;
  } catch (err) {
    if (err.code !== "42P01") throw err;
    await client.query("rollback to savepoint reg");
    hasRegistry = false;
  }
  await client.query("commit");
  console.log(hasRegistry ? "✓ Migration applied + geregistreerd." : "✓ Migration applied (registry bestaat nog niet — draai 0057).");
} catch (err) {
  try {
    await client.query("rollback");
  } catch {
    // ignore rollback errors — the original error below is what matters
  }
  console.error("✗ Migration failed — rolled back, nothing changed.");
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
