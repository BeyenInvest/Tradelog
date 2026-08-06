import type { PropAccount } from "../types";

/**
 * The prop-firm fields of a PropAccount this module reasons about. Every rule is
 * independently nullable (null = "not configured"); current_pnl_pct is the
 * manually-entered running total P&L% the rules are evaluated against.
 */
export type PropFirmRuleFields = Pick<
  PropAccount,
  "profit_target_pct" | "max_drawdown_pct" | "daily_loss_limit_pct" | "current_pnl_pct"
>;

export interface ProfitTargetStatus {
  targetPct: number;
  /** Fraction of the target reached, clamped to [0, 1] for a progress bar. 0 while at a loss. */
  progress: number;
  reached: boolean;
}

export interface DrawdownStatus {
  limitPct: number;
  /** Fraction of the loss buffer consumed, clamped to [0, 1]. 0 while in profit. */
  used: number;
  breached: boolean;
}

export interface PropFirmStatus {
  /** null when profit_target_pct or current_pnl_pct is unset. */
  profitTarget: ProfitTargetStatus | null;
  /** null when max_drawdown_pct or current_pnl_pct is unset. */
  drawdown: DrawdownStatus | null;
  /**
   * Configured daily-loss limit, shown for reference only. We store running total
   * P&L% on the account, not per-day P&L, so this cannot be evaluated against live
   * data — it's a reminder of the rule, never a computed progress. null when unset.
   */
  dailyLossLimitPct: number | null;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Evaluate an account's prop-firm rules against its manually-entered running
 * P&L%. Pure and presentation-free (colours/labels live in the component). Same
 * "handmatig, geen live koppeling" philosophy as the rest of the Accounts page:
 * nothing here reads trades — profit-target and max-drawdown progress derive
 * solely from current_pnl_pct. A rule that isn't configured yields null and the
 * UI omits it; when current_pnl_pct is null both computable statuses are null and
 * only the daily-loss reminder remains.
 */
export function computePropFirmStatus(acc: PropFirmRuleFields): PropFirmStatus {
  const pnl = acc.current_pnl_pct;

  let profitTarget: ProfitTargetStatus | null = null;
  if (acc.profit_target_pct != null && pnl != null) {
    const targetPct = acc.profit_target_pct;
    profitTarget = {
      targetPct,
      progress: clamp01(pnl / targetPct),
      reached: pnl >= targetPct,
    };
  }

  let drawdown: DrawdownStatus | null = null;
  if (acc.max_drawdown_pct != null && pnl != null) {
    const limitPct = acc.max_drawdown_pct;
    // Only a loss (negative running P&L) consumes the drawdown buffer.
    const loss = pnl < 0 ? -pnl : 0;
    drawdown = {
      limitPct,
      used: clamp01(loss / limitPct),
      breached: loss >= limitPct,
    };
  }

  return {
    profitTarget,
    drawdown,
    dailyLossLimitPct: acc.daily_loss_limit_pct,
  };
}
