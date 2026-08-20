import type { Trade } from "../types";
import { GRADED_EVALUATIONS, MIN_SAMPLE_SIZE, type GradedEvaluation } from "../constants";
import { closedTrades, computeOutcomeCounts, computeRStats, isGraded, isGradedError, round2, takenTrades, type ClosedTrade } from "./core";
import { groupByKey } from "./breakdown";

/**
 * Regel-adherentie (Fase N2): what does deviating from your own rules cost?
 * Two complementary views, both expressed in R (resultaat_pct / planned risk)
 * so trades taken at different risk sizes stay comparable:
 *
 *  1. computeEvaluationImpact — self-graded execution quality
 *     (trade_evaluation) linked to P&L: Good trades vs Emotional/Technical
 *     errors, plus the per-trade R gap between them.
 *  2. computeConditionGaps — per analysis dimension (setup fields, timing,
 *     custom fields), which value performed best vs worst in avg R, ranked by
 *     the size of that gap. Surfaces the conditions where sticking to (or
 *     ignoring) a rule makes the largest measured difference.
 *
 * All aggregation delegates to the shared core/breakdown helpers
 * (computeOutcomeCounts, computeRStats, groupByKey) so these numbers can never
 * drift from the Overview KPIs computed for the same trades. "Missed trade" is
 * hypothetical and counts nowhere: computeConditionGaps filters structurally
 * via takenTrades(), and the evaluation buckets only match the three graded
 * values.
 */

export interface EvaluationBucket {
  evaluation: GradedEvaluation;
  n: number;
  winRate: number;
  totalR: number;
  avgR: number | null;
}

export interface EvaluationImpact {
  /** Fixed order Good → Emotional → Technical, including n = 0 buckets — the view decides which rows to render. */
  buckets: EvaluationBucket[];
  /** Taken trades carrying any of the three grades. Ungraded trades count nowhere (same rule as computeDisciplineStats). */
  graded: number;
  /** Emotional + Technical combined. */
  errorN: number;
  errorAvgR: number | null;
  goodAvgR: number | null;
  /**
   * goodAvgR − errorAvgR: how much less an error trade returned per trade, in R,
   * compared to a rule-following trade. null until both sides have at least one
   * trade. Can be negative (errors that happened to outperform — small samples).
   */
  avgRGap: number | null;
  /**
   * errorN × avgRGap: the total R difference had the error trades performed at
   * the Good-trade average. An extrapolation, not realised P&L — the view labels
   * it as an estimate. null whenever avgRGap is null.
   */
  estimatedCostR: number | null;
}

export function computeEvaluationImpact(taken: ClosedTrade[]): EvaluationImpact {
  const byEvaluation = new Map<GradedEvaluation, ClosedTrade[]>(GRADED_EVALUATIONS.map((ev) => [ev, []]));
  for (const t of taken) {
    // Ungraded (null) and a stray "Missed trade" match no bucket and count nowhere.
    byEvaluation.get(t.trade_evaluation as GradedEvaluation)?.push(t);
  }

  const buckets: EvaluationBucket[] = GRADED_EVALUATIONS.map((evaluation) => {
    const bucket = byEvaluation.get(evaluation)!;
    const counts = computeOutcomeCounts(bucket);
    const r = computeRStats(bucket);
    return { evaluation, n: counts.n, winRate: counts.winRate, totalR: r.totalR, avgR: r.avgR };
  });

  const errorTrades = taken.filter(isGradedError);
  const goodAvgR = buckets[0].avgR;
  const errorAvgR = computeRStats(errorTrades).avgR;
  // The gap is taken over the already-rounded averages so the three numbers the
  // view interpolates into one sentence are always mutually consistent.
  const avgRGap = goodAvgR != null && errorAvgR != null ? round2(goodAvgR - errorAvgR) : null;

  return {
    buckets,
    graded: buckets.reduce((s, b) => s + b.n, 0),
    errorN: errorTrades.length,
    errorAvgR,
    goodAvgR,
    avgRGap,
    estimatedCostR: avgRGap != null ? round2(errorTrades.length * avgRGap) : null,
  };
}

export interface ConditionDimension {
  id: string;
  /** Same contract as groupByKey's keyFn: single key, array of keys (trade counts in each), or null (excluded). */
  keyFn: (t: Trade) => string | string[] | null;
}

export interface ConditionValueRow {
  key: string;
  n: number;
  avgR: number;
  /** Share of this bucket's *graded* trades flagged Emotional/Technical error; null when nothing in the bucket is graded. */
  errorRate: number | null;
}

export interface ConditionGap {
  dimensionId: string;
  /** Qualifying values (n ≥ minSample) sorted by avgR descending — rows[0] is the best value, rows[rows.length - 1] the worst. Always ≥ 2 rows. */
  rows: ConditionValueRow[];
  /** Best minus worst avgR, > 0 (a zero gap is no measurable difference and the dimension is omitted). */
  gapR: number;
}

/**
 * Per dimension: bucket trades by value (groupByKey, same fan-out contract as
 * breakdownBy), keep values with a meaningful sample (rekenregel 6,
 * MIN_SAMPLE_SIZE), and measure the avg-R spread between the best and worst
 * value. Dimensions with fewer than two qualifying values, or a zero gap, have
 * no measurable difference and are omitted. Result is ranked largest gap first
 * — "where does the choice of value cost the most per trade". Missed trades
 * are excluded structurally (takenTrades), on top of the caller contract.
 */
export function computeConditionGaps(
  trades: Trade[],
  dims: ConditionDimension[],
  opts: { minSample?: number } = {}
): ConditionGap[] {
  const minSample = opts.minSample ?? MIN_SAMPLE_SIZE;
  // Missed (takenTrades) AND still-running (closedTrades) excluded — an open trade
  // has no realized R to bucket, on top of the caller contract.
  const taken = closedTrades(takenTrades(trades));
  const gaps: ConditionGap[] = [];

  for (const dim of dims) {
    const rows: ConditionValueRow[] = [...groupByKey(taken, dim.keyFn).entries()]
      .filter(([, bucket]) => bucket.length >= minSample)
      .map(([key, bucket]) => {
        const graded = bucket.filter(isGraded).length;
        const errors = bucket.filter(isGradedError).length;
        return {
          key,
          n: bucket.length,
          // Non-null: groupByKey never creates an empty bucket, so computeRStats sees n ≥ 1.
          avgR: computeRStats(bucket).avgR!,
          errorRate: graded ? errors / graded : null,
        };
      })
      .sort((a, b) => b.avgR - a.avgR || a.key.localeCompare(b.key));

    if (rows.length < 2) continue;
    const gapR = round2(rows[0].avgR - rows[rows.length - 1].avgR);
    if (gapR <= 0) continue;
    gaps.push({ dimensionId: dim.id, rows, gapR });
  }

  return gaps.sort((a, b) => b.gapR - a.gapR || a.dimensionId.localeCompare(b.dimensionId));
}
