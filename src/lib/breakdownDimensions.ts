import type { Trade } from "./types";
import { currenciesOfPair } from "./constants";
import { weekdayKey, quarterKey } from "./stats/breakdown";

export interface DimensionConfig {
  id: string;
  label: string;
  keyFn: (t: Trade) => string | string[] | null;
}

/**
 * One entry per "Per X" split from spec 5.2. BacktestingPage renders every
 * entry through the same BreakdownTable/BreakdownGrid — this list is the only
 * place a new dimension needs to be added.
 */
export const BREAKDOWN_DIMENSIONS: DimensionConfig[] = [
  { id: "fase", label: "Per Fase", keyFn: (t) => t.fase },
  { id: "trade_concept", label: "Per Trade Concept", keyFn: (t) => t.trade_concept },
  { id: "entry", label: "Per Entry", keyFn: (t) => t.entry },
  { id: "cc", label: "Per CC (4H Candle Close)", keyFn: (t) => t.cc },
  { id: "sessie", label: "Per Sessie", keyFn: (t) => t.sessie },
  { id: "weekday", label: "Per Dag", keyFn: weekdayKey },
  { id: "quarter", label: "Per Kwartaal", keyFn: quarterKey },
  { id: "nieuws", label: "Per Nieuws", keyFn: (t) => (t.nieuws ? "Ja" : "Nee") },
  { id: "pair", label: "Per Pair", keyFn: (t) => t.pair },
  { id: "currency", label: "Per Currency", keyFn: (t) => currenciesOfPair(t.pair) },
  { id: "weekly_criteria", label: "Per Weekly Criteria", keyFn: (t) => t.weekly_criteria },
  { id: "weekly_kenmerk", label: "Per Weekly Kenmerk", keyFn: (t) => t.weekly_kenmerk },
];
