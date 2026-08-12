import type { TFunction } from "i18next";
import type { MethodologyField, Trade } from "./types";
import { currenciesOfPair, CCS, DIRECTIONS, SESSIES, WEEKDAYS, QUARTERS } from "./constants";
import { weekdayKey, quarterKey } from "./stats/breakdown";
import { dynamicMethodologyFields } from "./methodologyFields";
import { numberBucketer } from "./numberBuckets";

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
  /**
   * Translates a row's key into its display label. Kept separate from `keyFn` so
   * the grouping key stays a stable, language-independent identifier (e.g. "Ma",
   * "Ja") while the visible label follows the UI language. Omit → the key is shown
   * as-is (already-neutral values like tickers, CC slots, directions).
   */
  labelFn?: (key: string, t: TFunction) => string;
}

/** Localized weekday label — keys are the fixed WEEKDAYS abbreviations (Ma..Zo). */
const weekdayLabel = (k: string, t: TFunction) => t(`weekdays.${k}`);
/** Localized Yes/No for boolean dimensions — keys stay the stable "Ja"/"Nee". */
const boolLabel = (k: string, t: TFunction) => t(k === "Ja" ? "common.yes" : "common.no");

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
  { id: "weekday", keyFn: weekdayKey, sortOrder: WEEKDAYS, universal: true, labelFn: weekdayLabel },
  { id: "quarter", keyFn: quarterKey, sortOrder: QUARTERS, universal: true },
  // Instrument is the universal "what did you trade" (cyclus 7) — on a forex
  // journal instrument mirrors pair on every write path, so a separate "Per Pair"
  // dimension would render the identical table twice. Currency stays: that split
  // (per currency, both legs) is genuinely different and forex-only.
  { id: "instrument", keyFn: (t) => t.instrument ?? t.pair, universal: true },
  { id: "currency", keyFn: (t) => currenciesOfPair(t.pair), forex: true },
  // Small 2-value dimensions last: they leave a large empty gap if placed mid-grid next to wider tables.
  { id: "direction", keyFn: (t) => t.direction, sortOrder: DIRECTIONS, universal: true },
  { id: "nieuws", keyFn: (t) => (t.nieuws ? "Ja" : "Nee"), labelFn: boolLabel },
];

/**
 * Config-driven breakdown dimensions for a methodology's own custom fields
 * (Scope C, cyclus 4). Turns each analysable custom field into a "Per X" split
 * that reads its value from the trades.custom bag — the same generic breakdownBy
 * every fixed dimension uses. Enum + boolean bucket directly; a `number` field is
 * split into quartile ranges derived from the trades passed in (cyclus 7) — so it
 * needs the data, unlike the value-agnostic enum/boolean dims. `text` (too free)
 * and `date` are still skipped. On a legacy (WPM) journal the seeded legacy fields
 * are excluded — those keep their hardcoded columns + the per-fase analysis until
 * cyclus 10; on any other journal the same keys are ordinary user fields (see
 * dynamicMethodologyFields) and do get a breakdown.
 */
export function customFieldDimensions(fields: MethodologyField[], trades: Trade[] = []): DimensionConfig[] {
  const dims: DimensionConfig[] = [];
  for (const f of dynamicMethodologyFields(fields)) {
    if (f.field_type === "enum" || f.field_type === "boolean") {
      dims.push({
        id: `custom:${f.field_key}`,
        label: f.label,
        sortOrder: f.field_type === "enum" ? f.options ?? undefined : undefined,
        labelFn: f.field_type === "boolean" ? boolLabel : undefined,
        keyFn: (t: Trade) => {
          const raw = t.custom?.[f.field_key];
          if (raw == null || raw === "") return null;
          if (f.field_type === "boolean") return raw ? "Ja" : "Nee";
          return String(raw);
        },
      });
    } else if (f.field_type === "number") {
      const values = trades
        .map((t) => t.custom?.[f.field_key])
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const bucketer = numberBucketer(values);
      if (!bucketer) continue; // no numeric data yet → no dimension to show
      dims.push({
        id: `custom:${f.field_key}`,
        label: f.label,
        sortOrder: bucketer.order,
        keyFn: (t: Trade) => {
          const raw = t.custom?.[f.field_key];
          return typeof raw === "number" && Number.isFinite(raw) ? bucketer.keyForValue(raw) : null;
        },
      });
    }
  }
  return dims;
}
