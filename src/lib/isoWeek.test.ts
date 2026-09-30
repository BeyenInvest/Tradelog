import { describe, it, expect } from "vitest";
import { isoWeekOf, isoWeekRange, tradingDateOf, tradingWeekOf, weeksInIsoYear } from "./isoWeek";

describe("isoWeekOf", () => {
  it("maps a mid-year date to its ISO week", () => {
    expect(isoWeekOf("2026-07-15")).toEqual({ jaar: 2026, week_nummer: 29 });
  });

  it("year boundary: end-of-December days can belong to week 1 of the NEXT year", () => {
    // 2024-12-30 is the Monday of the week containing 2025's first Thursday.
    expect(isoWeekOf("2024-12-30")).toEqual({ jaar: 2025, week_nummer: 1 });
    expect(isoWeekOf("2024-12-31")).toEqual({ jaar: 2025, week_nummer: 1 });
  });

  it("year boundary: early-January days can belong to the last week of the PREVIOUS year", () => {
    // 2026 is a 53-week ISO year; its week 53 runs into January 2027.
    expect(isoWeekOf("2027-01-01")).toEqual({ jaar: 2026, week_nummer: 53 });
    expect(isoWeekOf("2027-01-03")).toEqual({ jaar: 2026, week_nummer: 53 });
    expect(isoWeekOf("2027-01-04")).toEqual({ jaar: 2027, week_nummer: 1 });
    // 2021-01-01 falls in 2020's week 53 (2020 is a 53-week year too).
    expect(isoWeekOf("2021-01-01")).toEqual({ jaar: 2020, week_nummer: 53 });
  });
});

describe("isoWeekRange", () => {
  it("returns the Monday-Sunday range of a mid-year week", () => {
    expect(isoWeekRange(2026, 29)).toEqual({ start: "2026-07-13", end: "2026-07-19" });
  });

  it("week 1 can start in the previous calendar year", () => {
    expect(isoWeekRange(2025, 1)).toEqual({ start: "2024-12-30", end: "2025-01-05" });
  });

  it("week 53 of a 53-week year runs into the next calendar year", () => {
    expect(isoWeekRange(2026, 53)).toEqual({ start: "2026-12-28", end: "2027-01-03" });
  });

  it("round-trips with isoWeekOf: every day of a week's range maps back to that week", () => {
    const { start, end } = isoWeekRange(2026, 53);
    expect(isoWeekOf(start)).toEqual({ jaar: 2026, week_nummer: 53 });
    expect(isoWeekOf(end)).toEqual({ jaar: 2026, week_nummer: 53 });
  });
});

describe("tradingDateOf / tradingWeekOf (handelsweek-regel: zondag ≥ 22:00 → volgende week)", () => {
  // 2026-07-19 is the Sunday of ISO week 29 (2026-07-13 t/m 2026-07-19).
  it("Sunday 21:59 stays in its own week", () => {
    expect(tradingDateOf("2026-07-19", "21:59")).toBe("2026-07-19");
    expect(tradingWeekOf("2026-07-19", "21:59")).toEqual({ jaar: 2026, week_nummer: 29 });
  });

  it("Sunday 22:00 (the boundary itself) rolls to the next week", () => {
    expect(tradingDateOf("2026-07-19", "22:00")).toBe("2026-07-20");
    expect(tradingWeekOf("2026-07-19", "22:00")).toEqual({ jaar: 2026, week_nummer: 30 });
  });

  it("accepts the DB's HH:MM:SS format too", () => {
    expect(tradingWeekOf("2026-07-19", "23:30:00")).toEqual({ jaar: 2026, week_nummer: 30 });
  });

  it("a Sunday trade WITHOUT a time stays in the old week (deliberate owner choice)", () => {
    expect(tradingDateOf("2026-07-19", null)).toBe("2026-07-19");
    expect(tradingWeekOf("2026-07-19", null)).toEqual({ jaar: 2026, week_nummer: 29 });
    expect(tradingWeekOf("2026-07-19", undefined)).toEqual({ jaar: 2026, week_nummer: 29 });
  });

  it("a late Saturday trade never rolls — only Sundays do", () => {
    expect(tradingDateOf("2026-07-18", "23:00")).toBe("2026-07-18");
    expect(tradingWeekOf("2026-07-18", "23:00")).toEqual({ jaar: 2026, week_nummer: 29 });
  });

  it("year rollover: Sunday 22:00 in the year's last week belongs to week 1 of the NEXT ISO year", () => {
    // 2027-01-03 is the Sunday of 2026's week 53; 22:00 rolls to Monday 2027-01-04 = week 1 of 2027.
    expect(tradingWeekOf("2027-01-03", "22:00")).toEqual({ jaar: 2027, week_nummer: 1 });
    expect(tradingWeekOf("2027-01-03", "21:59")).toEqual({ jaar: 2026, week_nummer: 53 });
    // Same at a calendar-year boundary inside December: Sunday 2025-12-28 22:00 → Monday 2025-12-29 = week 1 of 2026.
    expect(tradingWeekOf("2025-12-28", "22:00")).toEqual({ jaar: 2026, week_nummer: 1 });
    expect(tradingWeekOf("2025-12-28", null)).toEqual({ jaar: 2025, week_nummer: 52 });
  });
});

describe("weeksInIsoYear", () => {
  it("distinguishes 52- from 53-week ISO years", () => {
    expect(weeksInIsoYear(2024)).toBe(52);
    expect(weeksInIsoYear(2025)).toBe(52);
    expect(weeksInIsoYear(2026)).toBe(53); // starts on a Thursday
    expect(weeksInIsoYear(2020)).toBe(53); // leap year starting on a Wednesday
    expect(weeksInIsoYear(2027)).toBe(52);
  });
});
