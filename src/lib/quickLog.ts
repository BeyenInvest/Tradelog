import { TRADE_EVALUATIONS } from "@/lib/constants";
import type { TradeFormValues } from "@/lib/validation";

/**
 * Quick-log deliberately excludes "Missed trade": a missed trade is a hypothetical
 * logged with the full form, never a fast post-session entry — and it must never
 * pollute the taken-trade numbers (missed-trade contract, CLAUDE.md).
 */
export const QUICK_EVALUATIONS = TRADE_EVALUATIONS.filter((e) => e !== "Missed trade");

/**
 * Silent defaults for every field the quick-log form doesn't ask for — the same
 * neutral baseline a hand-entered trade or an import (dealToImportRow) starts
 * from: today's date, EURUSD, all screenshots null, custom {}. `outcome` is a
 * placeholder here; the form derives the real one from the sign of resultaat_pct
 * (deriveOutcome) so there's no second source of truth. Methodology-specific
 * fields (incl. the former WPM fields) live in `custom` since the fase-retirement
 * (0059); quick-log leaves them unset.
 *
 * Kept pure (no React/supabase) so a test can assert these defaults + a result
 * still satisfy tradeSchema — a guard against a new required field silently
 * breaking quick-log.
 */
export function quickLogDefaults(today: string): TradeFormValues {
  return {
    datum_open: today,
    // Defaults empty: quick-log is a fast *post-session* entry, so auto-stamping
    // "now" would silently record the log moment as the trade's open time (0051).
    // The form offers an optional time input (UX-D) for users who want to fill it.
    tijd_open: null,
    datum_sluiting: null,
    pair: "EURUSD",
    instrument: null,
    direction: null,
    is_open: false,
    outcome: "BE",
    resultaat_pct: 0,
    risk_pct: null,
    trade_evaluation: null,
    mae_pct: null,
    mfe_pct: null,
    planned_rr: null,
    entry_price: null,
    stop_price: null,
    target_price: null,
    exit_price: null,
    w_screenshot: null,
    d_screenshot: null,
    h4_screenshot: null,
    h2_screenshot: null,
    notes: null,
    custom: {},
    methodology_id: null,
  };
}
