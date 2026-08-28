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
 * from: fase (the journal's first, or "Fase 1"), today's date, cc "11", nieuws
 * false, all confirms/screenshots/kenmerken null, custom {}. `outcome` is a
 * placeholder here; the form derives the real one from the sign of resultaat_pct
 * (deriveOutcome) so there's no second source of truth.
 *
 * Kept pure (no React/supabase) so a test can assert these defaults + a result
 * still satisfy tradeSchema — a guard against a new required field silently
 * breaking quick-log.
 */
export function quickLogDefaults(fase: string, today: string): TradeFormValues {
  return {
    fase,
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
    notes: null,
    fase1_daily_respecteert_zone: null,
    fase1_spelers_verleden: null,
    fase2_daily_respecteert_zone: null,
    fase2_structuur: null,
    fase3_zone_min_2_touches: null,
    fase3_engulfing_candle: null,
    fase3_structuur: null,
    fase4_weekly_bevestigingscandle: null,
    custom: {},
    methodology_id: null,
  };
}
