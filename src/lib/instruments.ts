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

/**
 * Canonical form of a free instrument symbol: trim, collapse internal whitespace,
 * uppercase. This is the single normalizer for the free instrument field (cyclus
 * D) — applied both when curating a journal's instrument list and when saving a
 * trade — so "es"/"ES"/" es " all fold to one "ES" row in every breakdown instead
 * of fragmenting the Per-Instrument analysis. Returns "" for blank/whitespace-only
 * input (the caller decides whether that is allowed).
 */
export function normalizeInstrument(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * The curated instrument universe of a journal, read from its
 * `methodologies.instrument_config` jsonb (cyclus D). The source of truth is the
 * `instruments` array; for a futures preset that ships a `tick_values` lookup but
 * no explicit list yet, its keys (ES, NQ, …) seed a sensible starter list for
 * free. Values are normalized, de-duplicated and alphabetically sorted so the
 * form select and the Settings editor read from one clean, stable list.
 */
export function instrumentsOfConfig(config: Record<string, unknown> | null | undefined): string[] {
  if (!config) return [];
  const list = Array.isArray(config.instruments) ? (config.instruments as unknown[]) : [];
  const raw =
    list.length > 0
      ? list
      : config.tick_values && typeof config.tick_values === "object"
        ? Object.keys(config.tick_values as Record<string, unknown>)
        : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const norm = normalizeInstrument(v);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}
