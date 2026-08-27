import { describe, it, expect } from "vitest";
import {
  dayTotalsInUnit,
  mondayFirstOffset,
  monthTotalOf,
  monthWeeks,
  rowWeekNumber,
  tradesByDayOfMonth,
  weekTotalOf,
} from "@/lib/calendarTotals";

function t(datum_open: string, resultaat_pct: number, risk_pct: number | null = null) {
  return { datum_open, resultaat_pct, risk_pct };
}

describe("mondayFirstOffset", () => {
  it("0 when the month starts on a Monday", () => {
    expect(mondayFirstOffset(2026, 5)).toBe(0); // June 2026 starts on Monday
  });

  it("6 when the month starts on a Sunday", () => {
    expect(mondayFirstOffset(2026, 2)).toBe(6); // March 2026 starts on Sunday
  });
});

describe("monthWeeks", () => {
  it("pads the first row up to the month's first weekday and the last row to 7 cells", () => {
    const weeks = monthWeeks(2026, 7); // August 2026: starts Saturday, 31 days
    expect(weeks[0]).toEqual([null, null, null, null, null, 1, 2]);
    expect(weeks.at(-1)).toEqual([31, null, null, null, null, null, null]);
    for (const w of weeks) expect(w).toHaveLength(7);
  });

  it("covers exactly the month's days, once each, in order", () => {
    const days = monthWeeks(2026, 7).flat().filter((d): d is number => d != null);
    expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("a 28-day February starting on Monday needs no padding at all", () => {
    const weeks = monthWeeks(2027, 1); // February 2027 starts on Monday
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((d) => d != null)).toBe(true);
  });
});

describe("tradesByDayOfMonth", () => {
  it("buckets by day and drops trades from other months/years", () => {
    const m = tradesByDayOfMonth(
      [t("2026-08-03", 1), t("2026-08-03", -0.5), t("2026-08-21", 2), t("2026-07-31", 9), t("2025-08-03", 9)],
      2026,
      7
    );
    expect([...m.keys()].sort((a, b) => a - b)).toEqual([3, 21]);
    expect(m.get(3)).toHaveLength(2);
  });

  it("is pure string work — no timezone can shift a trade across midnight", () => {
    const m = tradesByDayOfMonth([t("2026-08-01", 1)], 2026, 7);
    expect(m.get(1)).toHaveLength(1);
  });
});

describe("dayTotalsInUnit", () => {
  it("sums a day's results in % and round2's the total", () => {
    const byDay = tradesByDayOfMonth([t("2026-08-03", 0.3), t("2026-08-03", -0.2), t("2026-08-03", -0.1)], 2026, 7);
    const totals = dayTotalsInUnit(byDay, "percent");
    // Raw float sum would be -2.8e-17 — the round2 invariant forces exact 0 (never -0).
    expect(totals.get(3)).toBe(0);
    expect(Object.is(totals.get(3), -0)).toBe(false);
  });

  it("converts per trade to R using each trade's own risk", () => {
    const byDay = tradesByDayOfMonth([t("2026-08-03", 2, 1), t("2026-08-03", -1, 0.5)], 2026, 7);
    expect(dayTotalsInUnit(byDay, "R").get(3)).toBe(0); // +2R and -2R
  });

  it("converts to currency off the saldo", () => {
    const byDay = tradesByDayOfMonth([t("2026-08-03", 1.5)], 2026, 7);
    expect(dayTotalsInUnit(byDay, "currency", 10000).get(3)).toBe(150);
  });
});

describe("weekTotalOf / monthTotalOf", () => {
  const byDay = tradesByDayOfMonth([t("2026-08-03", 1.1), t("2026-08-05", -0.4), t("2026-08-21", 2)], 2026, 7);
  const totals = dayTotalsInUnit(byDay, "percent");
  const weeks = monthWeeks(2026, 7);

  it("sums only the days inside the row, skipping padding", () => {
    // Row 1 = Aug 3-9 (the first full week).
    expect(weekTotalOf(weeks[1], totals)).toEqual({ total: 0.7, hasResult: true });
  });

  it("hasResult is false for a week with no realized trades (row renders no total)", () => {
    expect(weekTotalOf(weeks[0], totals)).toEqual({ total: 0, hasResult: false });
  });

  it("month total is the sum of the day totals", () => {
    expect(monthTotalOf(totals)).toBe(2.7);
  });
});

describe("rowWeekNumber", () => {
  it("reads the ISO week from the row's Monday, also when it spills into the previous month", () => {
    // August 2026 row 0 has its Monday on July 27 → ISO week 31.
    expect(rowWeekNumber(2026, 7, 0)).toBe(31);
    expect(rowWeekNumber(2026, 7, 1)).toBe(32); // Aug 3
  });

  it("year boundary: a January row whose Monday lies in December keeps the old year's week number", () => {
    // January 2027 starts on a Friday; row 0's Monday is 2026-12-28 → week 53 of 2026 (53-week year).
    expect(rowWeekNumber(2027, 0, 0)).toBe(53);
    expect(rowWeekNumber(2027, 0, 1)).toBe(1); // Monday 2027-01-04
  });
});
