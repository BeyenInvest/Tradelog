// F5 — sluiten vanaf de chart (plan §7.2). Pure orkestratie over ExtensionDb +
// het gedeelde rekenpad (priceMath/deriveOutcome): het paneel rekent zelf
// niets. Sluiten is een gerichte update-by-id; de 0043-check
// (trades_open_result_chk) bewaakt de open→gesloten-overgang server-side, dus
// een race met de web-app eindigt hooguit in een nette constraint-fout.
import {
  GRADED_EVALUATIONS, type Direction, type Outcome, type TradeEvaluation,
} from "../../src/lib/constants";
import { deriveOutcome } from "../../src/lib/import/mapToTrade";
import { plannedRR, realizedR, resultaatPctFromExit } from "../../src/lib/priceMath";
import { round2 } from "../../src/lib/stats/core";
import { normalizeTvSymbol } from "../../src/lib/symbolNormalize";
// Bewust uit de mini-module, niet uit tradePayload: die zou validation/zod de
// paneel-bundle in trekken (previewClose wordt door het content-script gebruikt).
import { wallClockInTimezone } from "../../src/lib/wallClock";
import type { ExtensionDb, OpenTradeInfo, ProfileInfo, SessionInfo } from "./db";

/** Open trade + wat het paneel alleen maar hoeft te tonen (nooit rekenen). */
export type OpenTradeMatch = OpenTradeInfo & { plannedRR: number | null };

export type OpenTradesResult =
  | { ok: true; trades: OpenTradeMatch[] }
  | { ok: false; stage: "auth" | "profile" | "build"; error: string; detail?: string };

export interface CloseTradeRequest {
  tradeId: string;
  /** datum_open van de trade (uit open-trades) — bewaakt sluitdatum ≥ opendatum. */
  datumOpen: string;
  /** Exit-prijs-pad (prijzen + risk bekend) óf handmatig %-resultaat. */
  result:
    | { kind: "exit-price"; direction: Direction; entry: number; stop: number; exit: number; riskPct: number | null }
    | { kind: "manual"; resultaatPct: number };
  /** Uitvoeringskwaliteit — "Missed trade" is hier NOOIT toegestaan (missed-trade-contract). */
  evaluation?: string | null;
  maePct?: number | null;
  mfePct?: number | null;
  /** Bar-tijd van het sluitmoment in UTC-seconden (replay-veilig, M4) … */
  closeTimeUtcSec?: number | null;
  /** … of een expliciete "YYYY-MM-DD" van de user. Nooit stil Date.now(). */
  manualDate?: string | null;
}

export type CloseTradeResult =
  | { ok: true; tradeId: string | null; outcome: Outcome; resultaatPct: number; datumSluiting: string }
  | { ok: false; stage: "auth" | "profile" | "build" | "update"; error: string; detail?: string };

type Gate =
  | { ok: true; session: SessionInfo; profile: ProfileInfo }
  | { ok: false; stage: "auth" | "profile"; error: string };

/** Zelfde poortwachters als logTradeFromChart: sessie + beta-profiel. */
async function gate(db: ExtensionDb): Promise<Gate> {
  const session = await db.getSessionInfo();
  if (!session) return { ok: false, stage: "auth", error: "not-linked" };
  const profile = await db.getProfile(session.userId);
  if (!profile) return { ok: false, stage: "profile", error: "profile-unreadable" };
  if (!profile.beta) return { ok: false, stage: "profile", error: "not-beta" };
  return { ok: true, session, profile };
}

/** Matcht een open trade op het genormaliseerde chart-symbool: pair óf
 * instrument (forex-journals spiegelen instrument = pair, dus pair wint). */
export function tradeMatchesSymbol(trade: OpenTradeInfo, symbol: { pair: string | null; instrument: string }): boolean {
  if (symbol.pair && trade.pair === symbol.pair) return true;
  return trade.instrument != null && trade.instrument === symbol.instrument;
}

export async function listOpenTradesForSymbol(db: ExtensionDb, symbolRaw: string): Promise<OpenTradesResult> {
  const gated = await gate(db);
  if (!gated.ok) return gated;

  const symbol = normalizeTvSymbol(symbolRaw);
  if (!symbol) return { ok: false, stage: "build", error: "symbol-unreadable", detail: symbolRaw };

  const open = await db.listOpenTrades(gated.profile.methodologyId);
  const trades = open
    .filter((t) => tradeMatchesSymbol(t, symbol))
    .map((t) => ({
      ...t,
      plannedRR:
        t.entryPrice != null && t.stopPrice != null && t.targetPrice != null
          ? plannedRR(t.entryPrice, t.stopPrice, t.targetPrice)
          : null,
    }));
  return { ok: true, trades };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function closeTradeFromChart(db: ExtensionDb, req: CloseTradeRequest): Promise<CloseTradeResult> {
  const gated = await gate(db);
  if (!gated.ok) return gated;

  // Missed-trade-contract: een gesloten positie is per definitie genomen —
  // alleen de drie "graded" evaluaties zijn hier legaal (of geen).
  let evaluation: TradeEvaluation | null = null;
  if (req.evaluation != null && req.evaluation !== "") {
    const graded = GRADED_EVALUATIONS.find((e) => e === req.evaluation);
    if (!graded) {
      return {
        ok: false, stage: "build",
        error: req.evaluation === "Missed trade" ? "missed-not-selectable" : "invalid-evaluation",
        detail: req.evaluation,
      };
    }
    evaluation = graded;
  }

  // Resultaat: uit de exit-prijs (rekenpad §7.1) of rechtstreeks handmatig.
  let resultaatPct: number;
  let exitPrice: number | null = null;
  if (req.result.kind === "exit-price") {
    const { direction, entry, stop, exit, riskPct } = req.result;
    if (!Number.isFinite(exit) || exit <= 0) {
      return { ok: false, stage: "build", error: "exit-price-invalid", detail: String(exit) };
    }
    const pct = resultaatPctFromExit(direction, entry, stop, exit, riskPct);
    if (pct == null) {
      // realizedR weigert bij stop===entry of een SL aan de verkeerde kant —
      // zelfde harde weigering als bij het loggen (geen stil "gecorrigeerde" R).
      return { ok: false, stage: "build", error: "direction-price-mismatch", detail: `${direction} ${entry}/${stop}` };
    }
    resultaatPct = pct;
    exitPrice = exit;
  } else {
    if (!Number.isFinite(req.result.resultaatPct)) {
      return { ok: false, stage: "build", error: "result-invalid" };
    }
    resultaatPct = round2(req.result.resultaatPct);
  }

  // MAE/MFE: positieve magnitudes (0049-checks) — ongeldig is een fout, geen gok.
  const excursion = (v: number | null | undefined): number | null | "invalid" => {
    if (v == null) return null;
    if (!Number.isFinite(v) || v < 0) return "invalid";
    return round2(v);
  };
  const mae = excursion(req.maePct);
  const mfe = excursion(req.mfePct);
  if (mae === "invalid" || mfe === "invalid") {
    return { ok: false, stage: "build", error: "invalid-excursion" };
  }

  // Sluitdatum: wall-clock in de profiel-tijdzone uit de bar-tijd van het
  // sluitmoment (replay-regel M4), anders de expliciete datum — nooit Date.now().
  let datumSluiting: string | null = null;
  if (req.closeTimeUtcSec != null) {
    datumSluiting = wallClockInTimezone(req.closeTimeUtcSec * 1000, gated.profile.timezone)?.date ?? null;
  }
  if (!datumSluiting && req.manualDate && DATE_RE.test(req.manualDate)) {
    datumSluiting = req.manualDate;
  }
  if (!datumSluiting) return { ok: false, stage: "build", error: "no-close-time" };
  if (DATE_RE.test(req.datumOpen) && datumSluiting < req.datumOpen) {
    return { ok: false, stage: "build", error: "close-before-open", detail: `${datumSluiting} < ${req.datumOpen}` };
  }

  const patch: Record<string, unknown> = {
    is_open: false,
    outcome: deriveOutcome(resultaatPct),
    resultaat_pct: resultaatPct,
    datum_sluiting: datumSluiting,
    trade_evaluation: evaluation,
    mae_pct: mae,
    mfe_pct: mfe,
  };
  // exit_price mag alleen op trades die al entry+stop dragen (prices_pair-check
  // 0058) — precies het exit-prijs-pad; het handmatige pad laat 'm ongemoeid.
  if (exitPrice != null) patch.exit_price = exitPrice;

  const updated = await db.updateTrade({ id: req.tradeId }, patch);
  if (!updated.ok) return { ok: false, stage: "update", error: updated.code, detail: updated.error };
  return {
    ok: true,
    tradeId: updated.tradeId,
    outcome: deriveOutcome(resultaatPct),
    resultaatPct,
    datumSluiting,
  };
}

/** Voor het sluit-formulier: live afgeleide R + % bij het typen van een exit —
 * één plek, zodat paneel-weergave en submit dezelfde uitkomst hebben. */
export function previewClose(
  direction: Direction, entry: number, stop: number, exit: number, riskPct: number | null
): { r: number; resultaatPct: number; outcome: Outcome } | null {
  const r = realizedR(direction, entry, stop, exit);
  const pct = resultaatPctFromExit(direction, entry, stop, exit, riskPct);
  if (r == null || pct == null) return null;
  return { r: round2(r), resultaatPct: pct, outcome: deriveOutcome(pct) };
}
