import { describe, it, expect } from "vitest";
import { computeDurationByOutcome } from "../duration";
import { closedTrades, takenTrades } from "../core";
import { makeTrade } from "./fixtures";

describe("computeDurationByOutcome", () => {
  it("averages duur_dagen per outcome and excludes trades without a duration", () => {
    const trades = closedTrades([
      makeTrade({ outcome: "Win", duur_dagen: 2 }),
      makeTrade({ outcome: "Win", duur_dagen: 4 }),
      makeTrade({ outcome: "Win", duur_dagen: null }), // no close date yet, excluded
      makeTrade({ outcome: "Loss", duur_dagen: 1 }),
    ]);
    const result = computeDurationByOutcome(trades);
    expect(result.Win).toEqual({ avgDays: 3, n: 2 });
    expect(result.Loss).toEqual({ avgDays: 1, n: 1 });
    expect(result.BE).toEqual({ avgDays: null, n: 0 });
  });

  it("D6 missed-guard: the takenTrades+closedTrades pipeline keeps a missed trade out of the duration stats", () => {
    const raw = [
      makeTrade({ outcome: "Win", duur_dagen: 2 }),
      // Hypothetical missed setup with a long "duration" — must never count.
      makeTrade({ outcome: "Win", duur_dagen: 40, trade_evaluation: "Missed trade" }),
    ];
    const result = computeDurationByOutcome(closedTrades(takenTrades(raw)));
    expect(result.Win).toEqual({ avgDays: 2, n: 1 });
  });
});
