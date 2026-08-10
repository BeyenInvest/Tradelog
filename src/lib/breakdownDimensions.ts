import type { MethodologyField, Trade } from "./types";
import { currenciesOfPair, CCS, DIRECTIONS, LEGACY_METHODOLOGY_FIELD_KEYS, SESSIES, WEEKDAYS, QUARTERS } from "./constants";
import { weekdayKey, quarterKey } from "./stats/breakdown";

export interface DimensionConfig {
  id: string;
  /** For fixed dimensions, also the i18n key under the "breakdown" namespace. */
  keyFn: (t: Trade) => string | string[] | null;
  /** Fixed display order (e.g. FASES) — omit for dimensions with no natural order (alphabetical/first-seen is fine). */
  sortOrder?: readonly string[];
  /** Ready-made title for config-driven (custom-field) dimensions, which have no i18n key — the field's own label. See BacktestingAnalysisView. */
  label?: string;
  /**
   * True for a dimension every journal captures regardless of methodology — date-derived
   * splits + the universal core fields (pair/currency/direction). A non-Weekly-Phase-Method
   * journal shows only these fixed dimensions (plus its own custom fields); the rest read
   * legacy WPM columns that such a journal never fills, so they'd be all-empty (cyclus 4).
   */
  universal?: boolean;
  /** Forex-only dimension (pair/currency split) — shown only for a forex journal (cyclus 7). */
  forex?: boolean;
}

/**
 * One entry per "Per X" split from spec 5.2. BacktestingPage renders every
 * entry through the same BreakdownTable/BreakdownGrid — this list is the only
 * place a new dimension needs to be added.
 */
export const BREAKDOWN_DIMENSIONS: DimensionConfig[] = [
  // No "fase" entry — that data lives in the Per Fase overview cards above this section, and a per-fase split of
  // the fase dimension itself is just a diagonal matrix (every off-diagonal cell is empty by construction).
  { id: "trade_concept", keyFn: (t) => t.trade_concept },
  { id: "entry", keyFn: (t) => t.entry },
  // Weekly data ranks above session/candle-close/pair/currency — it's the higher-signal dimension for this methodology.
  { id: "weekly_criteria", keyFn: (t) => t.weekly_criteria },
  { id: "weekly_kenmerk", keyFn: (t) => t.weekly_kenmerk },
  { id: "cc", keyFn: (t) => t.cc, sortOrder: CCS },
  { id: "sessie", keyFn: (t) => t.sessie, sortOrder: SESSIES },
  { id: "weekday", keyFn: weekdayKey, sortOrder: WEEKDAYS, universal: true },
  { id: "quarter", keyFn: quarterKey, sortOrder: QUARTERS, universal: true },
  // Instrument is the universal "what did you trade" (cyclus 7); pair/currency are
  // the forex-specific split, shown only for a forex journal.
  { id: "instrument", keyFn: (t) => t.instrument ?? t.pair, universal: true },
  { id: "pair", keyFn: (t) => t.pair, forex: true },
  { id: "currency", keyFn: (t) => currenciesOfPair(t.pair), forex: true },
  // Small 2-value dimensions last: they leave a large empty gap if placed mid-grid next to wider tables.
  { id: "direction", keyFn: (t) => t.direction, sortOrder: DIRECTIONS, universal: true },
  { id: "nieuws", keyFn: (t) => (t.nieuws ? "Ja" : "Nee") },
];

/**
 * Config-driven breakdown dimensions for a methodology's own custom fields
 * (Scope C, cyclus 4). Turns each analysable custom field into a "Per X" split
 * that reads its value from the trades.custom bag — the same generic breakdownBy
 * every fixed dimension uses. Only enum + boolean are bucketable out of the box;
 * number (needs range buckets), text (too free) and date are skipped for now.
 * Legacy WPM fields are excluded — those keep their hardcoded columns + the
 * per-fase / fase-kenmerken analysis until cyclus 10.
 */
export function customFieldDimensions(fields: MethodologyField[]): DimensionConfig[] {
  return fields
    .filter(
      (f) =>
        !LEGACY_METHODOLOGY_FIELD_KEYS.has(f.field_key) &&
        !f.is_computed &&
        (f.field_type === "enum" || f.field_type === "boolean")
    )
    .map((f) => ({
      id: `custom:${f.field_key}`,
      label: f.label,
      sortOrder: f.field_type === "enum" ? f.options ?? undefined : undefined,
      keyFn: (t: Trade) => {
        const raw = t.custom?.[f.field_key];
        if (raw == null || raw === "") return null;
        if (f.field_type === "boolean") return raw ? "Ja" : "Nee";
        return String(raw);
      },
    }));
}
