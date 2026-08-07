import { round2 } from "@/lib/stats/core";
import type { Outcome, Pair } from "@/lib/constants";
import type { ImportBroker, ImportTradeRow, ParsedDeal } from "./types";

/** Small tolerance around zero so a spread-only scratch reads as break-even, not a micro win/loss. */
const BE_EPSILON = 0.005;

/**
 * Resolves a deal's result as a % return, honouring the user's chosen basis:
 *   1. a broker-provided return % (used verbatim if present),
 *   2. else derive an exact per-trade % from the running balance
 *      (balance_before = balance_after − pnl → pnl / balance_before),
 *   3. else fall back to a single account balance the user enters for the import.
 * Returns null when none of these are available (the caller then asks for a
 * balance, or flags the row as unimportable).
 */
export function resolveResultaatPct(deal: ParsedDeal, accountBalance: number | null): number | null {
  if (deal.returnPct != null) return round2(deal.returnPct);

  if (deal.pnlAmount != null && deal.balanceAfter != null) {
    const balanceBefore = deal.balanceAfter - deal.pnlAmount;
    if (balanceBefore > 0) return round2((deal.pnlAmount / balanceBefore) * 100);
  }

  if (deal.pnlAmount != null && accountBalance != null && accountBalance > 0) {
    return round2((deal.pnlAmount / accountBalance) * 100);
  }

  return null;
}

/** Win/Loss/BE from the sign of the % result — the same sign-based lens the equity/expectancy stats use. */
export function deriveOutcome(resultaatPct: number): Outcome {
  if (resultaatPct > BE_EPSILON) return "Win";
  if (resultaatPct < -BE_EPSILON) return "Loss";
  return "BE";
}

/**
 * Builds an insert-ready trade row from a resolved deal. Everything the broker
 * can't tell us is left at the same neutral defaults a hand-entered trade would
 * start from: fase "Fase 1" (DB is not-null; respected by hide_fase), cc "11"
 * (the trade form's own default — session breakdowns for imports can be adjusted
 * later), and every methodology/kenmerk field null. trade_evaluation stays null:
 * an imported trade is always a *taken* trade, never "Missed" — so it can never
 * pollute the missed-trade contract. The original broker symbol is preserved in
 * notes for traceability.
 */
export function dealToImportRow(
  deal: ParsedDeal,
  pair: Pair,
  resultaatPct: number,
  broker: ImportBroker
): ImportTradeRow {
  const datumOpen = deal.openTime ?? deal.closeTime!; // caller guarantees at least one date
  return {
    fase: "Fase 1",
    datum_open: datumOpen,
    datum_sluiting: deal.closeTime ?? null,
    pair,
    outcome: deriveOutcome(resultaatPct),
    resultaat_pct: resultaatPct,
    risk_pct: null,
    trade_evaluation: null,
    weekly_criteria: null,
    weekly_kenmerk: null,
    trade_concept: null,
    entry: null,
    cc: "11",
    nieuws: false,
    w_confirm: null,
    d_confirm: null,
    h4_confirm: null,
    w_screenshot: null,
    d_screenshot: null,
    h4_screenshot: null,
    h2_screenshot: null,
    extra_d_conf: null,
    notes: `Geïmporteerd (${broker}): ${deal.symbol}`,
    fase1_daily_respecteert_zone: null,
    fase1_spelers_verleden: null,
    fase2_daily_respecteert_zone: null,
    fase2_structuur: null,
    fase3_zone_min_2_touches: null,
    fase3_engulfing_candle: null,
    fase3_structuur: null,
    fase4_weekly_bevestigingscandle: null,
    import_ref: `${broker}:${deal.ticket}`,
  };
}
