import type { Trade } from "../types";
import type { Fase, Outcome } from "../constants";
import { FASES } from "../constants";
import { round2 } from "./core";
import type { BreakdownRow } from "./breakdown";

/**
 * TPFS (TP on First Structure) is a hypothetical, parallel result — rekenregel
 * 2 says it must NEVER exclude trades from the main statistics. This module is
 * the only place tpfs_pct is read for statistics; core.ts/breakdown.ts never
 * touch it, which structurally guarantees that isolation instead of relying on
 * convention.
 */
export function tpfsOutcomeOf(tpfsPct: number): Outcome {
  return tpfsPct > 0 ? "Win" : tpfsPct < 0 ? "Loss" : "BE";
}

export interface TpfsStats {
  n: number;
  winRate: number;
  beRate: number;
  lossRate: number;
  avgTpfs: number;
  totalTpfs: number;
  byFase: BreakdownRow<Fase>[];
}

export function computeTpfsStats(trades: Trade[]): TpfsStats {
  const withTpfs = trades.filter((t): t is Trade & { tpfs_pct: number } => t.tpfs_pct != null);
  const n = withTpfs.length;
  const wins = withTpfs.filter((t) => tpfsOutcomeOf(t.tpfs_pct) === "Win").length;
  const losses = withTpfs.filter((t) => tpfsOutcomeOf(t.tpfs_pct) === "Loss").length;
  const be = withTpfs.filter((t) => tpfsOutcomeOf(t.tpfs_pct) === "BE").length;
  const totalTpfs = round2(withTpfs.reduce((s, t) => s + t.tpfs_pct, 0));

  const byFase: BreakdownRow<Fase>[] = FASES.map((fase) => {
    const bucket = withTpfs.filter((t) => t.fase === fase);
    const bn = bucket.length;
    const bWins = bucket.filter((t) => tpfsOutcomeOf(t.tpfs_pct) === "Win").length;
    const bLosses = bucket.filter((t) => tpfsOutcomeOf(t.tpfs_pct) === "Loss").length;
    const bBe = bucket.filter((t) => tpfsOutcomeOf(t.tpfs_pct) === "BE").length;
    return {
      key: fase,
      label: fase,
      n: bn,
      resultaatTotal: round2(bucket.reduce((s, t) => s + t.tpfs_pct, 0)),
      wins: bWins,
      be: bBe,
      losses: bLosses,
      winRate: bn ? bWins / bn : 0,
      beRate: bn ? bBe / bn : 0,
      lossRate: bn ? bLosses / bn : 0,
      isLowSample: bn < 15,
    };
  });

  return {
    n,
    winRate: n ? wins / n : 0,
    beRate: n ? be / n : 0,
    lossRate: n ? losses / n : 0,
    avgTpfs: n ? round2(totalTpfs / n) : 0,
    totalTpfs,
    byFase,
  };
}
