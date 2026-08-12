/**
 * Quartile bucketing for numeric custom fields, so a "Per X" breakdown can split
 * on a number field (R:R, leverage, stop-distance, …) the same way it splits on
 * an enum (cyclus 7 refinement). Pure — no React/data-store deps — so the bucket
 * boundaries are unit-testable directly.
 */

/** Format a boundary for a bucket label: trim trailing zeros, cap at 2 decimals. */
function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** Linear-interpolation quantile on an ascending-sorted array (same method as numpy's default). */
export function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface NumberBucketer {
  /** Bucket labels in ascending value order — feed as `sortOrder` to breakdownBy. */
  order: string[];
  /** Maps a raw numeric value to its bucket label. */
  keyForValue: (v: number) => string;
}

/**
 * Builds buckets for a set of numeric values:
 *  - few distinct values (≤ 6) → one bucket per exact value (e.g. R:R 1/2/3),
 *    which reads far better than lumping three discrete levels into quartiles;
 *  - otherwise → four quartile ranges (≤ Q1, Q1–Q2, Q2–Q3, > Q3).
 * Returns null when there's nothing to bucket, so the caller drops the dimension.
 */
export function numberBucketer(values: number[]): NumberBucketer | null {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;

  const distinct = Array.from(new Set(nums)).sort((a, b) => a - b);
  if (distinct.length <= 6) {
    return { order: distinct.map(fmt), keyForValue: (v) => fmt(v) };
  }

  const sorted = [...nums].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const q2 = quantileSorted(sorted, 0.5);
  const q3 = quantileSorted(sorted, 0.75);
  const labels = [`≤ ${fmt(q1)}`, `${fmt(q1)}–${fmt(q2)}`, `${fmt(q2)}–${fmt(q3)}`, `> ${fmt(q3)}`];
  // Heavily skewed data can make quartiles coincide, duplicating a range label —
  // dedupe `order` (it feeds sortOrder/React keys); keyForValue still uses the
  // positional labels, and a deduped-away label's bucket is unreachable anyway.
  const order = Array.from(new Set(labels));
  // Boundaries are inclusive on the upper edge, so every value lands in exactly one
  // bucket. Skewed data can make two quartiles equal → an empty middle bucket, which
  // breakdownBy simply omits (only buckets with trades render), so no double counting.
  const keyForValue = (v: number) => (v <= q1 ? labels[0] : v <= q2 ? labels[1] : v <= q3 ? labels[2] : labels[3]);
  return { order, keyForValue };
}
