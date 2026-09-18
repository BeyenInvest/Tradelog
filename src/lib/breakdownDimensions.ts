import type { TFunction } from "i18next";
import type { MethodologyField, Trade } from "./types";
import { currenciesOfPair, DIRECTIONS, SESSIES, WEEKDAYS, QUARTERS } from "./constants";
import { weekdayKey, quarterKey } from "./stats/breakdown";
import { dynamicMethodologyFields } from "./methodologyFields";
import { fieldLabel } from "./fieldBlocks";
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
   * True for a dimension every journal captures regardless of methodology — the
   * date-derived splits + the universal core fields (instrument/direction/sessie).
   * Since the fase-retirement (0059) every methodology-specific split (fase, cc,
   * concept, …) is a custom-field dimension (customFieldDimensions), so all the
   * fixed dimensions here are universal.
   */
  universal?: boolean;
  /** Forex-only dimension (pair/currency split) — shown only for a forex journal (cyclus 7). */
  forex?: boolean;
  /**
   * Calendar-derived split (weekday/quarter): not a condition the trader chooses
   * or a rule to adhere to, so the Regel-adherentie section skips it (owner
   * feedback, Fase N2) — the plain breakdown tables already cover these.
   */
  dateDerived?: boolean;
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
/** Fixed hour-of-day keys "00".."23" — the wall-clock hour of trades.tijd_open (0051). */
const UREN = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
/** Localized Yes/No for boolean dimensions — keys stay the stable "Ja"/"Nee". */
const boolLabel = (k: string, t: TFunction) => t(k === "Ja" ? "common.yes" : "common.no");

/**
 * One entry per "Per X" split from spec 5.2. BacktestingPage renders every
 * entry through the same BreakdownTable/BreakdownGrid — this list is the only
 * place a new dimension needs to be added.
 */
export const BREAKDOWN_DIMENSIONS: DimensionConfig[] = [
  // Every methodology-specific split (fase, cc, concept, weekly_*, nieuws, …) is a
  // custom-field dimension now (customFieldDimensions) — only the universal,
  // date-derived and forex splits are fixed here (fase-retirement 0059).
  // Session on the real time axis: the DB derives `sessie` from tijd_open (else
  // custom.cc on a WPM journal); a trade with neither has sessie=null and drops out.
  { id: "sessie", keyFn: (t) => t.sessie, sortOrder: SESSIES, universal: true },
  { id: "weekday", keyFn: weekdayKey, sortOrder: WEEKDAYS, universal: true, dateDerived: true, labelFn: weekdayLabel },
  { id: "quarter", keyFn: quarterKey, sortOrder: QUARTERS, universal: true, dateDerived: true },
  // Hour-of-day on the real time axis (Fase S2, 0051) — the trade's own wall-clock
  // open hour, so no tz conversion needed. Trades without tijd_open drop out (null),
  // and the whole card stays hidden until any trade carries a time (rows.length
  // filter in the view).
  { id: "uur", keyFn: (t) => (t.tijd_open ? t.tijd_open.slice(0, 2) : null), sortOrder: UREN, universal: true, dateDerived: true, labelFn: (k) => `${k}:00` },
  // Instrument is the universal "what did you trade" (cyclus 7) — on a forex
  // journal instrument mirrors pair on every write path, so a separate "Per Pair"
  // dimension would render the identical table twice. Currency stays: that split
  // (per currency, both legs) is genuinely different and forex-only.
  { id: "instrument", keyFn: (t) => t.instrument ?? t.pair, universal: true },
  { id: "currency", keyFn: (t) => currenciesOfPair(t.pair), forex: true },
  // Small 2-value dimension last: it leaves a large empty gap if placed mid-grid next to wider tables.
  { id: "direction", keyFn: (t) => t.direction, sortOrder: DIRECTIONS, universal: true },
];

/**
 * Config-driven breakdown dimensions for a methodology's own custom fields
 * (Scope C, cyclus 4). Turns each analysable custom field into a "Per X" split
 * that reads its value from the trades.custom bag — the same generic breakdownBy
 * every fixed dimension uses. Enum + boolean bucket directly; a `number` field is
 * split into quartile ranges derived from the trades passed in (cyclus 7) — so it
 * needs the data, unlike the value-agnostic enum/boolean dims. `text` (too free)
 * and `date` are still skipped. Since the fase-retirement (0059) the former WPM
 * fields (fase, cc, weekly_*, …) are ordinary custom fields, so they get a
 * breakdown here like any other (see dynamicMethodologyFields).
 */
export function customFieldDimensions(fields: MethodologyField[], trades: Trade[] = [], t?: TFunction): DimensionConfig[] {
  const dims: DimensionConfig[] = [];
  // UI callers pass `t` so a catalogue-backed field's title follows the UI
  // language (0047); without it the stored (creation-language) label is used.
  const labelOf = (f: MethodologyField) => (t ? fieldLabel(t, f) : f.label);
  for (const f of dynamicMethodologyFields(fields)) {
    if (f.field_type === "enum" || f.field_type === "boolean") {
      dims.push({
        id: `custom:${f.field_key}`,
        label: labelOf(f),
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
        label: labelOf(f),
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
