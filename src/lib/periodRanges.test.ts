import { describe, it, expect } from "vitest";
import { monthRange, quarterRange, yearRange, rangeOfPeriod } from "./periodRanges";

describe("monthRange", () => {
  it("gives the first and last day of a 31-day month", () => {
    expect(monthRange(2026, 7)).toEqual({ start: "2026-07-01", end: "2026-07-31" });
  });
  it("gives the first and last day of February in a leap year", () => {
    expect(monthRange(2028, 2)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
  it("gives the first and last day of February in a non-leap year", () => {
    expect(monthRange(2026, 2)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
  it("handles December correctly (rolls into next year internally, but end stays in December)", () => {
    expect(monthRange(2026, 12)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});

describe("quarterRange", () => {
  it("Q1 = Jan-Mar", () => {
    expect(quarterRange(2026, 1)).toEqual({ start: "2026-01-01", end: "2026-03-31" });
  });
  it("Q3 = Jul-Sep", () => {
    expect(quarterRange(2026, 3)).toEqual({ start: "2026-07-01", end: "2026-09-30" });
  });
  it("Q4 = Oct-Dec", () => {
    expect(quarterRange(2026, 4)).toEqual({ start: "2026-10-01", end: "2026-12-31" });
  });
});

describe("yearRange", () => {
  it("spans the full calendar year", () => {
    expect(yearRange(2026)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});

describe("rangeOfPeriod", () => {
  it("delegates to the right range function per period type", () => {
    expect(rangeOfPeriod("month", 2026, 7)).toEqual(monthRange(2026, 7));
    expect(rangeOfPeriod("quarter", 2026, 3)).toEqual(quarterRange(2026, 3));
    expect(rangeOfPeriod("year", 2026, null)).toEqual(yearRange(2026));
  });
});
