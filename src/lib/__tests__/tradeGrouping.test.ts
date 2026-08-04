import { describe, it, expect } from "vitest";
import { groupTrades, matchesSearch } from "../tradeGrouping";
import { makeTrade } from "../stats/__tests__/fixtures";

describe("groupTrades", () => {
  it("month: groups by calendar month with a Dutch label", () => {
    const trades = [makeTrade({ datum_open: "2026-07-15" }), makeTrade({ datum_open: "2026-07-02" })];
    const groups = groupTrades(trades, "month");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "2026-07", label: "Juli 2026" });
    expect(groups[0].trades).toHaveLength(2);
  });

  it("week: two dates in the same Mon-Sun week share a bucket, a third in the next week doesn't", () => {
    // 2026-07-06 is a Monday, 2026-07-12 is the Sunday of the same week, 2026-07-13 is the next Monday.
    const trades = [
      makeTrade({ datum_open: "2026-07-06" }),
      makeTrade({ datum_open: "2026-07-12" }),
      makeTrade({ datum_open: "2026-07-13" }),
    ];
    const groups = groupTrades(trades, "week");
    expect(groups).toHaveLength(2);
    expect(groups[0].trades).toHaveLength(2);
    expect(groups[1].trades).toHaveLength(1);
  });

  it("week: handles the ISO year-boundary case (2024-12-30 falls in week 1 of 2025)", () => {
    const groups = groupTrades([makeTrade({ datum_open: "2024-12-30" })], "week");
    expect(groups[0].key).toBe("2025-W01");
  });

  it("resultaatTotal sums the group's trades", () => {
    const trades = [
      makeTrade({ datum_open: "2026-07-01", resultaat_pct: 1.5 }),
      makeTrade({ datum_open: "2026-07-02", resultaat_pct: -0.5 }),
    ];
    expect(groupTrades(trades, "month")[0].resultaatTotal).toBe(1);
  });

  it("backtestDag: groups by the day a trade was logged (created_at), not its historical datum_open", () => {
    const trades = [
      makeTrade({ datum_open: "2020-01-01", created_at: "2026-08-04T09:00:00Z" }),
      makeTrade({ datum_open: "2019-06-15", created_at: "2026-08-04T14:00:00Z" }),
      makeTrade({ datum_open: "2021-03-03", created_at: "2026-08-03T09:00:00Z" }),
    ];
    const groups = groupTrades(trades, "backtestDag");
    expect(groups).toHaveLength(2);
    expect(groups[0].trades).toHaveLength(2);
    expect(groups[1].trades).toHaveLength(1);
  });
});

describe("matchesSearch", () => {
  it("empty query matches everything", () => {
    expect(matchesSearch(makeTrade({ pair: "EURUSD" }), "")).toBe(true);
  });

  it("matches case-insensitively against pair, fase, concept, entry and notes", () => {
    const t = makeTrade({ pair: "GBPUSD", trade_concept: "Reversal", notes: "Sterke daily zone" });
    expect(matchesSearch(t, "gbpusd")).toBe(true);
    expect(matchesSearch(t, "reversal")).toBe(true);
    expect(matchesSearch(t, "daily zone")).toBe(true);
    expect(matchesSearch(t, "eurusd")).toBe(false);
  });

  it("null fields don't crash the search", () => {
    const t = makeTrade({ trade_concept: null, entry: null, notes: null });
    expect(matchesSearch(t, "anything")).toBe(false);
  });
});
