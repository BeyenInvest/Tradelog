import type { Trade } from "./types";
import type { DateRange } from "./periodRanges";
import type { Pair, Outcome, TradeEvaluation, Sessie, Direction } from "./constants";
import { tradingDateOf } from "./isoWeek";

export type { DateRange };

/**
 * Period scope for the Journal: a plain date range, except that the week
 * preset marks itself `tradingWeek` — that range then filters on the trading
 * week (tradingDateOf: zondag ≥ 22:00 hoort bij de week erna) instead of on
 * the bare datum_open. Month/quarter/year/custom ranges stay purely
 * date-based (owner-besluit 2026-09-30, plan-handelsweek-zondag §6).
 */
export interface JournalPeriod extends DateRange {
  tradingWeek?: boolean;
}

export interface JournalFilters {
  pair?: Pair;
  /** Free instrument match (cyclus 7) — case-insensitive substring on `instrument ?? pair`, for non-forex journals. */
  instrument?: string;
  direction?: Direction;
  outcome?: Outcome;
  tradeEvaluation?: TradeEvaluation;
  sessie?: Sessie;
  /**
   * Filters on the active journal's own custom fields (Scope C, cyclus E), keyed
   * by field_key. enum → the chosen option string; boolean → true/false. A key is
   * present only while that field is being filtered; matched against trades.custom.
   * Since the fase-retirement (0059) the former WPM fields (fase, nieuws, …) are
   * ordinary custom fields and filter through here too.
   */
  custom?: Record<string, string | boolean>;
}

export const EMPTY_FILTERS: JournalFilters = {};

export function activeFilterCount(f: JournalFilters): number {
  const { custom, ...fixed } = f;
  const fixedCount = Object.values(fixed).filter((v) => v !== undefined).length;
  return fixedCount + (custom ? Object.keys(custom).length : 0);
}

function inRange(t: Trade, range: JournalPeriod | null): boolean {
  if (!range) return true;
  const date = range.tradingWeek ? tradingDateOf(t.datum_open, t.tijd_open) : t.datum_open;
  return date >= range.start && date <= range.end;
}

/** Period + Journal filters, applied together — the single gate everything in TradeJournalView flows through. */
export function applyJournalFilters(trades: Trade[], range: JournalPeriod | null, filters: JournalFilters): Trade[] {
  return trades.filter((t) => {
    if (!inRange(t, range)) return false;
    if (filters.pair && t.pair !== filters.pair) return false;
    if (filters.instrument && !(t.instrument ?? t.pair).toLowerCase().includes(filters.instrument.toLowerCase())) return false;
    if (filters.direction && t.direction !== filters.direction) return false;
    if (filters.outcome && t.outcome !== filters.outcome) return false;
    if (filters.tradeEvaluation && t.trade_evaluation !== filters.tradeEvaluation) return false;
    if (filters.sessie && t.sessie !== filters.sessie) return false;
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
