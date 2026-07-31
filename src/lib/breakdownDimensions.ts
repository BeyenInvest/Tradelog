import type { Trade } from "./types";
import { currenciesOfPair, CCS, SESSIES, WEEKDAYS, QUARTERS } from "./constants";
import { weekdayKey, quarterKey } from "./stats/breakdown";

export interface DimensionConfig {
  id: string;
  label: string;
  keyFn: (t: Trade) => string | string[] | null;
  /** Fixed display order (e.g. FASES) — omit for dimensions with no natural order (alphabetical/first-seen is fine). */
  sortOrder?: readonly string[];
}

/**
 * One entry per "Per X" split from spec 5.2. BacktestingPage renders every
 * entry through the same BreakdownTable/BreakdownGrid — this list is the only
 * place a new dimension needs to be added.
 */
export const BREAKDOWN_DIMENSIONS: DimensionConfig[] = [
  // No "fase" entry — that data lives in the Per Fase overview cards above this section, and a per-fase split of
  // the fase dimension itself is just a diagonal matrix (every off-diagonal cell is empty by construction).
  { id: "trade_concept", label: "Per Trade Concept", keyFn: (t) => t.trade_concept },
  { id: "entry", label: "Per Entry", keyFn: (t) => t.entry },
  // Weekly data ranks above session/candle-close/pair/currency — it's the higher-signal dimension for this methodology.
  { id: "weekly_criteria", label: "Per Weekly Criteria", keyFn: (t) => t.weekly_criteria },
  { id: "weekly_kenmerk", label: "Per Weekly Kenmerk", keyFn: (t) => t.weekly_kenmerk },
  { id: "cc", label: "Per CC (4H Candle Close)", keyFn: (t) => t.cc, sortOrder: CCS },
  { id: "sessie", label: "Per Sessie", keyFn: (t) => t.sessie, sortOrder: SESSIES },
  { id: "weekday", label: "Per Dag", keyFn: weekdayKey, sortOrder: WEEKDAYS },
  { id: "quarter", label: "Per Kwartaal", keyFn: quarterKey, sortOrder: QUARTERS },
  { id: "pair", label: "Per Pair", keyFn: (t) => t.pair },
  { id: "currency", label: "Per Currency", keyFn: (t) => currenciesOfPair(t.pair) },
  // Last: only 2 rows (Ja/Nee), so it leaves a large empty gap if placed mid-grid next to wider tables.
  { id: "nieuws", label: "Per Nieuws", keyFn: (t) => (t.nieuws ? "Ja" : "Nee") },
];
