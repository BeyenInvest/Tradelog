import type { Trade } from "./types";
import type { DateRange } from "./periodRanges";
import type { Pair, Outcome, TradeEvaluation, Sessie, Direction } from "./constants";

export type { DateRange };

export interface JournalFilters {
  /** A fase name from the user's methodology (Scope C) — free text, not the fixed Fase enum. */
  fase?: string;
  pair?: Pair;
  /** Free instrument match (cyclus 7) — case-insensitive substring on `instrument ?? pair`, for non-forex journals. */
  instrument?: string;
  direction?: Direction;
  outcome?: Outcome;
  tradeEvaluation?: TradeEvaluation;
  sessie?: Sessie;
  nieuws?: boolean;
}

export const EMPTY_FILTERS: JournalFilters = {};

export function activeFilterCount(f: JournalFilters): number {
  return Object.values(f).filter((v) => v !== undefined).length;
}

function inRange(dateIso: string, range: DateRange | null): boolean {
  if (!range) return true;
  return dateIso >= range.start && dateIso <= range.end;
}

/** Period + Journal filters, applied together — the single gate everything in TradeJournalView flows through. */
export function applyJournalFilters(trades: Trade[], range: DateRange | null, filters: JournalFilters): Trade[] {
  return trades.filter((t) => {
    if (!inRange(t.datum_open, range)) return false;
    if (filters.fase && t.fase !== filters.fase) return false;
    if (filters.pair && t.pair !== filters.pair) return false;
    if (filters.instrument && !(t.instrument ?? t.pair).toLowerCase().includes(filters.instrument.toLowerCase())) return false;
    if (filters.direction && t.direction !== filters.direction) return false;
    if (filters.outcome && t.outcome !== filters.outcome) return false;
    if (filters.tradeEvaluation && t.trade_evaluation !== filters.tradeEvaluation) return false;
    if (filters.sessie && t.sessie !== filters.sessie) return false;
    if (filters.nieuws !== undefined && t.nieuws !== filters.nieuws) return false;
    return true;
  });
}
