import type { Trade } from "../types";
import type { TradeEvaluation } from "../constants";
import { isMissed, round2 } from "./core";

/**
 * The two trade_evaluation values that mark a taken trade as a discipline slip.
 * "Good trade" is clean execution; "Missed trade" is a setup never taken (its
 * own category, handled below), so neither counts as an error.
 */
const ERROR_EVALUATIONS: readonly TradeEvaluation[] = ["Emotional error", "Technical error"];

export function isErrorEvaluation(ev: TradeEvaluation | null): boolean {
  return ev != null && ERROR_EVALUATIONS.includes(ev);
}

export interface DisciplineImpact {
  /** Taken (non-missed) trades in the set — the denominator for errorRate. */
  takenCount: number;
  /** Net resultaat_pct actually captured across all taken trades (= the real period result). */
  takenResultPct: number;
  /** Taken trades flagged Emotional/Technical error. */
  errorCount: number;
  /** errorCount / takenCount, 0 when there are no taken trades. */
  errorRate: number;
  /** Net resultaat_pct booked on error-flagged trades (signed — usually negative). */
  errorResultPct: number;
  /**
   * How much the total resultaat would improve if the error trades were removed
   * = -errorResultPct. Positive means the errors cost you that much ("zonder
   * deze errors had ik +X% gehaald"). This is a counterfactual on *removing* the
   * trades, not on executing them correctly — the correct-execution outcome is
   * unknowable, so we don't guess it.
   */
  errorCostPct: number;
  /** Missed setups (trade_evaluation = "Missed trade") in the set. */
  missedCount: number;
  /**
   * Net hypothetical resultaat_pct across missed setups (signed). Positive = net
   * profit left on the table; negative = setups that would have lost, so skipping
   * them actually helped.
   */
  missedResultPct: number;
}

/**
 * Discipline-cost metrics: what execution errors and missed setups did to the
 * bottom line. Deliberately the one stats function that looks at *both* taken
 * and missed trades in a single set (it splits them internally with isMissed) —
 * every other stats entry point is fed taken-only trades, because missed trades
 * carry a hypothetical result that must never dilute real performance. Here the
 * hypothetical is exactly the point.
 */
export function computeDisciplineImpact(
  trades: Pick<Trade, "trade_evaluation" | "resultaat_pct">[]
): DisciplineImpact {
  let takenCount = 0;
  let takenResultPct = 0;
  let errorCount = 0;
  let errorResultPct = 0;
  let missedCount = 0;
  let missedResultPct = 0;

  for (const t of trades) {
    if (isMissed(t)) {
      missedCount += 1;
      missedResultPct += t.resultaat_pct;
    } else {
      takenCount += 1;
      takenResultPct += t.resultaat_pct;
      if (isErrorEvaluation(t.trade_evaluation)) {
        errorCount += 1;
        errorResultPct += t.resultaat_pct;
      }
    }
  }

  const roundedErrorResult = round2(errorResultPct);
  return {
    takenCount,
    takenResultPct: round2(takenResultPct),
    errorCount,
    errorRate: takenCount ? errorCount / takenCount : 0,
    errorResultPct: roundedErrorResult,
    errorCostPct: round2(-roundedErrorResult),
    missedCount,
    missedResultPct: round2(missedResultPct),
  };
}

export interface MarketCapture {
  /** Total that was theoretically capturable = what you took, plus what errors and skipped setups cost. */
  availablePct: number;
  /** What you actually banked (net taken result). */
  capturedPct: number;
  /** availablePct − capturedPct = errorCostPct + missedResultPct. */
  leftOnTablePct: number;
  /** capturedPct / availablePct as a fraction — can be negative (you gave back) or >1 (rare). */
  capturedShare: number;
}

/**
 * The synthesis a trader writes by hand every monthly/quarterly review:
 * "er zat X% in de markt, ik pakte Y%, ik liet Z% liggen." Returns null when
 * there's nothing meaningful to say — no errors and no missed setups, nothing
 * actually left on the table, or a non-positive available pool (dividing a
 * capture-% out of that would mislead).
 */
export function computeMarketCapture(impact: DisciplineImpact): MarketCapture | null {
  if (impact.errorCount === 0 && impact.missedCount === 0) return null;
  const leftOnTablePct = round2(impact.errorCostPct + impact.missedResultPct);
  if (leftOnTablePct <= 0) return null; // errors/skips netted out to a help, not a cost — no regret to surface
  const capturedPct = impact.takenResultPct;
  const availablePct = round2(capturedPct + leftOnTablePct);
  if (availablePct <= 0) return null;
  return { availablePct, capturedPct, leftOnTablePct, capturedShare: capturedPct / availablePct };
}
