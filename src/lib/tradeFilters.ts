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
  /**
   * Filters on the active journal's own custom fields (Scope C, cyclus E), keyed
   * by field_key. enum → the chosen option string; boolean → true/false. A key is
   * present only while that field is being filtered; matched against trades.custom.
   */
  custom?: Record<string, string | boolean>;
}

export const EMPTY_FILTERS: JournalFilters = {};

export function activeFilterCount(f: JournalFilters): number {
  const { custom, ...fixed } = f;
  const fixedCount = Object.values(fixed).filter((v) => v !== undefined).length;
  return fixedCount + (custom ? Object.keys(custom).length : 0);
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
    if (filters.custom) {
      for (const [key, want] of Object.entries(filters.custom)) {
        const have = t.custom?.[key];
        if (typeof want === "boolean") {
          // A boolean field only matches its exact value; missing (null) matches neither
          // true nor false — same "unset is not false" rule the nieuws filter follows.
          if (have !== want) return false;
        } else if (have == null || String(have) !== want) {
          return false;
        }
      }
    }
    return true;
  });
}
