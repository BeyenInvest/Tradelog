import { describe, expect, it } from "vitest";
import { numberBucketer, quantileSorted } from "../numberBuckets";

describe("quantileSorted", () => {
  it("interpolates linearly between points", () => {
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantileSorted([10], 0.9)).toBe(10);
  });
});

describe("numberBucketer", () => {
  it("returns null when there is nothing numeric to bucket", () => {
    expect(numberBucketer([])).toBeNull();
    expect(numberBucketer([NaN, Infinity])).toBeNull();
  });

  it("buckets few distinct values one-per-value, ascending", () => {
    const b = numberBucketer([2, 1, 3, 1, 2])!;
    expect(b.order).toEqual(["1", "2", "3"]);
    expect(b.keyForValue(1)).toBe("1");
    expect(b.keyForValue(3)).toBe("3");
  });

  it("trims trailing zeros in exact-value labels", () => {
    const b = numberBucketer([1.5, 2.0, 2.5])!;
    expect(b.order).toEqual(["1.5", "2", "2.5"]);
  });

  it("dedupes coinciding quartile labels on heavily skewed data", () => {
    // 7 distinct values (> 6 → quartile mode) but the mass sits on one value, so
    // q1 = q2 = q3 — the coinciding range labels must not repeat in `order`.
    const values = [...Array.from({ length: 30 }, () => 1), 2, 3, 4, 5, 6, 0.5];
    const b = numberBucketer(values)!;
    expect(new Set(b.order).size).toBe(b.order.length);
    // Every value still maps to a label that is present in `order`.
    for (const v of values) expect(b.order).toContain(b.keyForValue(v));
  });

  it("splits into four quartile ranges for many distinct values", () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20, all distinct
    const b = numberBucketer(values)!;
    expect(b.order).toHaveLength(4);
    // Every value lands in exactly one bucket, and only 4 buckets are ever used.
    const used = new Set(values.map((v) => b.keyForValue(v)));
    expect(used.size).toBeLessThanOrEqual(4);
    // Lowest value in the first bucket, highest in the last.
    expect(b.keyForValue(1)).toBe(b.order[0]);
    expect(b.keyForValue(20)).toBe(b.order[3]);
  });
});
