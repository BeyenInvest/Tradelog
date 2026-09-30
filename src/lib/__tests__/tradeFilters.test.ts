import { describe, it, expect } from "vitest";
import { applyJournalFilters, activeFilterCount } from "../tradeFilters";
import { makeTrade } from "../stats/__tests__/fixtures";

describe("applyJournalFilters", () => {
  it("returns all trades when no period and no filters are set", () => {
    const trades = [makeTrade({ datum_open: "2026-01-01" }), makeTrade({ datum_open: "2026-06-15" })];
    expect(applyJournalFilters(trades, null, {})).toHaveLength(2);
  });

  it("keeps only trades with datum_open inside the range, inclusive of both ends", () => {
    const trades = [
      makeTrade({ id: "before", datum_open: "2026-06-30" }),
      makeTrade({ id: "start", datum_open: "2026-07-01" }),
      makeTrade({ id: "inside", datum_open: "2026-07-15" }),
      makeTrade({ id: "end", datum_open: "2026-07-31" }),
      makeTrade({ id: "after", datum_open: "2026-08-01" }),
    ];
    const result = applyJournalFilters(trades, { start: "2026-07-01", end: "2026-07-31" }, {});
    expect(result.map((t) => t.id)).toEqual(["start", "inside", "end"]);
  });

  it("a tradingWeek range follows the handelsweek-regel: Sunday ≥ 22:00 belongs to the NEXT week", () => {
    // Week 29 of 2026 = Mon 2026-07-13 t/m Sun 2026-07-19.
    const trades = [
      makeTrade({ id: "monday", datum_open: "2026-07-13" }),
      makeTrade({ id: "early-sunday", datum_open: "2026-07-19", tijd_open: "21:59" }),
      makeTrade({ id: "late-sunday", datum_open: "2026-07-19", tijd_open: "22:00" }),
      makeTrade({ id: "prev-late-sunday", datum_open: "2026-07-12", tijd_open: "23:00" }),
    ];
    const week29 = { start: "2026-07-13", end: "2026-07-19", tradingWeek: true };
    expect(applyJournalFilters(trades, week29, {}).map((t) => t.id)).toEqual(["monday", "early-sunday", "prev-late-sunday"]);
    // Without the flag the same dates filter purely on datum_open (month/quarter/year/custom behaviour).
    const plain = { start: "2026-07-13", end: "2026-07-19" };
    expect(applyJournalFilters(trades, plain, {}).map((t) => t.id)).toEqual(["monday", "early-sunday", "late-sunday"]);
  });

  it("combines period and dimension filters with AND semantics", () => {
    const trades = [
      makeTrade({ id: "match", datum_open: "2026-07-10", pair: "EURUSD", custom: { fase: "Fase 2" } }),
      makeTrade({ id: "wrong-fase", datum_open: "2026-07-10", pair: "EURUSD", custom: { fase: "Fase 1" } }),
      makeTrade({ id: "wrong-period", datum_open: "2026-08-10", pair: "EURUSD", custom: { fase: "Fase 2" } }),
    ];
    const result = applyJournalFilters(trades, { start: "2026-07-01", end: "2026-07-31" }, { pair: "EURUSD", custom: { fase: "Fase 2" } });
    expect(result.map((t) => t.id)).toEqual(["match"]);
  });

  it("nieuws (now a custom field) distinguishes false from unset (undefined means 'alle')", () => {
    const trades = [makeTrade({ id: "yes", custom: { nieuws: true } }), makeTrade({ id: "no", custom: { nieuws: false } })];
    expect(applyJournalFilters(trades, null, { custom: { nieuws: false } }).map((t) => t.id)).toEqual(["no"]);
    expect(applyJournalFilters(trades, null, {})).toHaveLength(2);
  });

  it("filters on a custom enum field by exact value, dropping missing values", () => {
    const trades = [
      makeTrade({ id: "rev", custom: { setup: "Reversal" } }),
      makeTrade({ id: "cont", custom: { setup: "Continuation" } }),
      makeTrade({ id: "none", custom: {} }),
    ];
    const result = applyJournalFilters(trades, null, { custom: { setup: "Reversal" } });
    expect(result.map((t) => t.id)).toEqual(["rev"]);
  });

  it("filters on a custom boolean field, treating missing as neither true nor false", () => {
    const trades = [
      makeTrade({ id: "t", custom: { at_key_level: true } }),
      makeTrade({ id: "f", custom: { at_key_level: false } }),
      makeTrade({ id: "unset", custom: {} }),
    ];
    expect(applyJournalFilters(trades, null, { custom: { at_key_level: true } }).map((t) => t.id)).toEqual(["t"]);
    expect(applyJournalFilters(trades, null, { custom: { at_key_level: false } }).map((t) => t.id)).toEqual(["f"]);
  });

  it("ANDs multiple custom filters together", () => {
    const trades = [
      makeTrade({ id: "both", custom: { setup: "Reversal", at_key_level: true } }),
      makeTrade({ id: "one", custom: { setup: "Reversal", at_key_level: false } }),
    ];
    const result = applyJournalFilters(trades, null, { custom: { setup: "Reversal", at_key_level: true } });
    expect(result.map((t) => t.id)).toEqual(["both"]);
  });
});

describe("activeFilterCount", () => {
  it("counts fixed filters and each custom-field key", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ outcome: "Win" })).toBe(1);
    expect(activeFilterCount({ outcome: "Win", custom: { setup: "Reversal", at_key_level: true } })).toBe(3);
    expect(activeFilterCount({ custom: {} })).toBe(0);
  });
});
