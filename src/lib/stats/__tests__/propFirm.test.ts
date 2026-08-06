import { describe, it, expect } from "vitest";
import { computePropFirmStatus, type PropFirmRuleFields } from "../propFirm";

function fields(over: Partial<PropFirmRuleFields> = {}): PropFirmRuleFields {
  return {
    profit_target_pct: null,
    max_drawdown_pct: null,
    daily_loss_limit_pct: null,
    current_pnl_pct: null,
    ...over,
  };
}

describe("computePropFirmStatus", () => {
  it("returns all-null/empty when no rules are configured", () => {
    expect(computePropFirmStatus(fields())).toEqual({
      profitTarget: null,
      drawdown: null,
      dailyLossLimitPct: null,
    });
  });

  it("computes profit-target progress from running P&L", () => {
    const s = computePropFirmStatus(fields({ profit_target_pct: 8, current_pnl_pct: 4 }));
    expect(s.profitTarget).toEqual({ targetPct: 8, progress: 0.5, reached: false });
  });

  it("marks the profit target reached and clamps the bar at 1", () => {
    const s = computePropFirmStatus(fields({ profit_target_pct: 8, current_pnl_pct: 10 }));
    expect(s.profitTarget).toEqual({ targetPct: 8, progress: 1, reached: true });
  });

  it("treats a loss as 0 progress toward the profit target", () => {
    const s = computePropFirmStatus(fields({ profit_target_pct: 8, current_pnl_pct: -3 }));
    expect(s.profitTarget).toEqual({ targetPct: 8, progress: 0, reached: false });
  });

  it("consumes drawdown buffer only while at a loss", () => {
    expect(computePropFirmStatus(fields({ max_drawdown_pct: 10, current_pnl_pct: -5 })).drawdown).toEqual({
      limitPct: 10,
      used: 0.5,
      breached: false,
    });
    // In profit → no buffer consumed.
    expect(computePropFirmStatus(fields({ max_drawdown_pct: 10, current_pnl_pct: 3 })).drawdown).toEqual({
      limitPct: 10,
      used: 0,
      breached: false,
    });
  });

  it("flags a breached max drawdown and clamps the bar at 1", () => {
    const s = computePropFirmStatus(fields({ max_drawdown_pct: 10, current_pnl_pct: -12 }));
    expect(s.drawdown).toEqual({ limitPct: 10, used: 1, breached: true });
  });

  it("passes the daily-loss limit through as reference only", () => {
    const s = computePropFirmStatus(fields({ daily_loss_limit_pct: 5 }));
    expect(s.dailyLossLimitPct).toBe(5);
    expect(s.profitTarget).toBeNull();
    expect(s.drawdown).toBeNull();
  });

  it("leaves computable statuses null when running P&L is unset", () => {
    const s = computePropFirmStatus(fields({ profit_target_pct: 8, max_drawdown_pct: 10 }));
    expect(s.profitTarget).toBeNull();
    expect(s.drawdown).toBeNull();
  });
});
