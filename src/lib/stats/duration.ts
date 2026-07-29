import type { Trade } from "../types";
import type { Outcome } from "../constants";
import { OUTCOMES } from "../constants";
import { round2 } from "./core";

export type DurationByOutcome = Record<Outcome, { avgDays: number | null; n: number }>;

/** Gemiddelde duur (dagen) per outcome. Open trades (duur_dagen null) zijn uitgesloten. */
export function computeDurationByOutcome(trades: Trade[]): DurationByOutcome {
  const result = {} as DurationByOutcome;
  for (const outcome of OUTCOMES) {
    const days = trades
      .filter((t) => t.outcome === outcome && t.duur_dagen != null)
      .map((t) => t.duur_dagen as number);
    result[outcome] = {
      n: days.length,
      avgDays: days.length ? round2(days.reduce((s, d) => s + d, 0) / days.length) : null,
    };
  }
  return result;
}
