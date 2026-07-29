import { describe, it, expect } from "vitest";
import { computeDurationByOutcome } from "../duration";
import { makeTrade } from "./fixtures";

describe("computeDurationByOutcome", () => {
  it("averages duur_dagen per outcome and excludes open trades", () => {
    const trades = [
      makeTrade({ outcome: "Win", duur_dagen: 2 }),
      makeTrade({ outcome: "Win", duur_dagen: 4 }),
      makeTrade({ outcome: "Win", duur_dagen: null }), // still open, excluded
      makeTrade({ outcome: "Loss", duur_dagen: 1 }),
    ];
    const result = computeDurationByOutcome(trades);
    expect(result.Win).toEqual({ avgDays: 3, n: 2 });
    expect(result.Loss).toEqual({ avgDays: 1, n: 1 });
    expect(result.BE).toEqual({ avgDays: null, n: 0 });
  });
});
