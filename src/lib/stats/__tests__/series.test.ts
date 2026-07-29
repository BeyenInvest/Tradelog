import { describe, it, expect } from "vitest";
import { groupIntoSeries } from "../series";
import { makeSequence } from "./fixtures";

describe("groupIntoSeries", () => {
  it("groups chronologically into chunks of 5, with a partial final group", () => {
    const trades = makeSequence(Array.from({ length: 12 }, () => "Win" as const));
    const series = groupIntoSeries(trades);
    expect(series).toHaveLength(3);
    expect(series[0].trades).toHaveLength(5);
    expect(series[1].trades).toHaveLength(5);
    expect(series[2].trades).toHaveLength(2);
  });

  it("computes resultaatTotal and winCount per series", () => {
    const trades = makeSequence(["Win", "Win", "Loss", "BE", "Win"]);
    const [series1] = groupIntoSeries(trades);
    expect(series1.winCount).toBe(3);
    expect(series1.resultaatTotal).toBe(2); // 1+1-1+0+1
  });
});
