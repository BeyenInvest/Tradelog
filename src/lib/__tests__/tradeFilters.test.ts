import { describe, it, expect } from "vitest";
import { applyJournalFilters } from "../tradeFilters";
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

  it("combines period and dimension filters with AND semantics", () => {
    const trades = [
      makeTrade({ id: "match", datum_open: "2026-07-10", fase: "Fase 2", pair: "EURUSD" }),
      makeTrade({ id: "wrong-fase", datum_open: "2026-07-10", fase: "Fase 1", pair: "EURUSD" }),
      makeTrade({ id: "wrong-period", datum_open: "2026-08-10", fase: "Fase 2", pair: "EURUSD" }),
    ];
    const result = applyJournalFilters(trades, { start: "2026-07-01", end: "2026-07-31" }, { fase: "Fase 2", pair: "EURUSD" });
    expect(result.map((t) => t.id)).toEqual(["match"]);
  });

  it("nieuws filter distinguishes false from unset (undefined means 'alle')", () => {
    const trades = [makeTrade({ id: "yes", nieuws: true }), makeTrade({ id: "no", nieuws: false })];
    expect(applyJournalFilters(trades, null, { nieuws: false }).map((t) => t.id)).toEqual(["no"]);
    expect(applyJournalFilters(trades, null, {})).toHaveLength(2);
  });
});
