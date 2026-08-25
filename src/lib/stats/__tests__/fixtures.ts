import type { Outcome } from "../../constants";
import type { ClosedTrade } from "../core";

let counter = 0;

/** Minimal, valid closed-trade factory for stats-lib tests. Override only what the test cares about. Returns a ClosedTrade (non-null outcome/resultaat) since every realized-stats helper reads that shape; pass `is_open: true` explicitly for an open-trade case. */
export function makeTrade(overrides: Partial<ClosedTrade> = {}): ClosedTrade {
  counter += 1;
  const id = overrides.id ?? `trade-${String(counter).padStart(4, "0")}`;
  return {
    id,
    user_id: "user-1",
    fase: "Fase 1",
    datum_open: "2026-01-01",
    tijd_open: null,
    datum_sluiting: null,
    duur_dagen: null,
    pair: "EURUSD",
    instrument: "EURUSD",
    direction: null,
    is_open: false,
    outcome: "Win",
    resultaat_pct: 1,
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
    sessie: "London",
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
    fase3_beide: null,
    fase3_structuur: null,
    fase4_weekly_bevestigingscandle: null,
    weekly_review_id: null,
    backtest_project_id: null,
    import_ref: null,
    methodology_id: null,
    custom: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Builds a chronological sequence of closed trades from a compact outcome list, one day apart. */
export function makeSequence(
  outcomes: Array<{ outcome: Outcome; resultaat_pct?: number } | Outcome>
): ClosedTrade[] {
  return outcomes.map((entry, i) => {
    const day = String(i + 1).padStart(2, "0");
    const spec = typeof entry === "string" ? { outcome: entry } : entry;
    const defaultResult = spec.outcome === "Win" ? 1 : spec.outcome === "Loss" ? -1 : 0;
    return makeTrade({
      datum_open: `2026-01-${day}`,
      outcome: spec.outcome,
      resultaat_pct: spec.resultaat_pct ?? defaultResult,
    });
  });
}
