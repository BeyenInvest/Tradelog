// G2 (deep review 2026-09-17): migratienummer/schema.sql-drift-check voor CI.
// Geen DB nodig — puur bestandsniveau:
//  1. elk migratiebestand heet NNNN_naam.sql (4 cijfers);
//  2. nummers zijn uniek (uitzondering: het historische 0020-duo — twee
//     bestanden, beide gedraaid, bewust zo gelaten);
//  3. de header van supabase/schema.sql noemt het hóógste migratienummer
//     ("t/m NNNN") — de conventie is dat elke migratie schema.sql in dezelfde
//     commit bijwerkt, en dit is de goedkoopste wachter op die afspraak.
// Faalt hard (exit 1) met een uitlegbare melding; CI draait dit na de lint.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const SCHEMA_FILE = "supabase/schema.sql";
// Historisch dubbel nummer (zie schema.sql-header): niet opnieuw toestaan.
const KNOWN_DUPLICATES = new Set(["0020"]);

const errors = [];

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
if (files.length === 0) errors.push(`${MIGRATIONS_DIR} bevat geen .sql-bestanden`);

const numbers = new Map(); // "0061" -> [bestandsnamen]
for (const file of files) {
  const m = /^(\d{4})_.+\.sql$/.exec(file);
  if (!m) {
    errors.push(`migratiebestand volgt de NNNN_naam.sql-conventie niet: ${file}`);
    continue;
  }
  const num = m[1];
  if (!numbers.has(num)) numbers.set(num, []);
  numbers.get(num).push(file);
}

for (const [num, names] of numbers) {
  if (names.length > 1 && !KNOWN_DUPLICATES.has(num)) {
    errors.push(
      `migratienummer ${num} is hergebruikt (${names.join(", ")}) — nummers nooit hergebruiken, pak het eerstvolgende vrije nummer`
    );
  }
}

const highest = [...numbers.keys()].sort().at(-1);
const schema = readFileSync(join(SCHEMA_FILE), "utf8");
// De header draagt "t/m NNNN" als eindstand-marker.
const marker = /t\/m\s+(\d{4})/u.exec(schema);
if (!marker) {
  errors.push(`${SCHEMA_FILE} mist de "t/m NNNN"-eindstand-marker in de header`);
} else if (highest && marker[1] !== highest) {
  errors.push(
    `schema.sql-drift: header zegt eindstand "t/m ${marker[1]}" maar de hoogste migratie is ${highest} — ` +
      `werk supabase/schema.sql bij in dezelfde commit als de migratie (conventie sinds fixplan blok C)`
  );
}

if (errors.length > 0) {
  console.error("check:migrations FAALT:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`check:migrations OK — ${files.length} migraties, hoogste = ${highest}, schema.sql in sync`);
