import type { Trade } from "../types";
import { sortChronological, round2 } from "./core";

export interface TradeSeries {
  seriesIndex: number;
  trades: Trade[];
  resultaatTotal: number;
  winCount: number;
}

/** Chronological grouping into series of `size` consecutive trades (default 5). */
export function groupIntoSeries(trades: Trade[], size = 5): TradeSeries[] {
  const sorted = sortChronological(trades);
  const series: TradeSeries[] = [];

  for (let i = 0; i < sorted.length; i += size) {
    const chunk = sorted.slice(i, i + size);
    series.push({
      seriesIndex: series.length + 1,
      trades: chunk,
      resultaatTotal: round2(chunk.reduce((s, t) => s + t.resultaat_pct, 0)),
      winCount: chunk.filter((t) => t.outcome === "Win").length,
    });
  }

  return series;
}
