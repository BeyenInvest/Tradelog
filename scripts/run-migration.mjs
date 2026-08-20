// Runs a single SQL migration file against the database in SUPABASE_DB_URL.
//
// Usage:
//   node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0043_open_trades.sql
//
// The whole file is executed inside one transaction: either every statement
// lands or none does. Migrations here are written to be idempotent/re-runnable
// (add-column-if-not-exists, drop-constraint-if-exists, create-or-replace), so
// re-running a file that already applied is safe.
//
// Needs SUPABASE_DB_URL (the direct Postgres connection string, incl. password)
// in the loaded env — that's what `--env-file=.env.local` provides.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

// Supabase requires TLS; the pooler cert isn't in Node's default CA store, so
// don't reject it. (A local Postgres over a plain socket needs no ssl.)
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const client = new pg.Client({
  connectionString,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`Running ${file} …`);
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("✓ Migration applied.");
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
