/**
 * Distinct, trimmed, alphabetically sorted instrument symbols from raw trade
 * rows. Pure (no React/Supabase deps) so it can be unit-tested directly — blanks/
 * whitespace and duplicates are dropped so the datalist stays a clean pick-list.
 */
export function distinctInstruments(rows: { instrument: string | null }[]): string[] {
  return Array.from(
    new Set(rows.map((r) => r.instrument?.trim()).filter((v): v is string => Boolean(v)))
  ).sort((a, b) => a.localeCompare(b));
}
