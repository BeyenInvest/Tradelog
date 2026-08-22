import { describe, it, expect } from "vitest";
import { isoWeekOf, isoWeekRange, weeksInIsoYear } from "./isoWeek";

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

describe("weeksInIsoYear", () => {
  it("distinguishes 52- from 53-week ISO years", () => {
    expect(weeksInIsoYear(2024)).toBe(52);
    expect(weeksInIsoYear(2025)).toBe(52);
    expect(weeksInIsoYear(2026)).toBe(53); // starts on a Thursday
    expect(weeksInIsoYear(2020)).toBe(53); // leap year starting on a Wednesday
    expect(weeksInIsoYear(2027)).toBe(52);
  });
});
