import { useTranslation } from "react-i18next";
import type { PropAccount } from "@/lib/types";
import { computePropFirmStatus } from "@/lib/stats";

function Bar({ fraction, tone }: { fraction: number; tone: "win" | "loss" }) {
  return (
    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
      <div
        className={`h-full rounded-full ${tone === "win" ? "bg-win" : "bg-loss"}`}
        style={{ width: `${Math.round(fraction * 100)}%` }}
      />
    </div>
  );
}

/**
 * Read-only display of an account's prop-firm rules and progress toward them.
 * Shared by the editable AccountList and the admin ReadOnlyAccountList so both
 * render identical bars. Renders nothing when no rule is configured. All maths
 * lives in computePropFirmStatus — this component is presentation only.
 */
export function PropFirmProgress({ account }: { account: PropAccount }) {
  const { t } = useTranslation();
  const status = computePropFirmStatus(account);
  const hasRule =
    account.profit_target_pct != null || account.max_drawdown_pct != null || account.daily_loss_limit_pct != null;
  if (!hasRule) return null;

  return (
    <div className="flex flex-col gap-2.5 mt-3">
      <p className="font-body text-xs uppercase tracking-wider text-muted">{t("accounts.propFirmRules")}</p>

      {account.profit_target_pct != null && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted">{t("accounts.profitTarget")}</span>
            <span className={status.profitTarget?.reached ? "text-win" : "text-ink"}>
              {status.profitTarget?.reached && `${t("accounts.targetReached")} · `}
              {account.current_pnl_pct != null ? `${account.current_pnl_pct}% / ` : ""}
              {account.profit_target_pct}%
            </span>
          </div>
          {status.profitTarget && <Bar fraction={status.profitTarget.progress} tone="win" />}
        </div>
      )}

      {account.max_drawdown_pct != null && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted" title={t("accounts.maxDrawdownStaticHint")}>
              {t("accounts.maxDrawdownStatic")}
            </span>
            <span className={status.drawdown?.breached ? "text-loss" : "text-ink"}>
              {status.drawdown?.breached && `${t("accounts.limitBreached")} · `}
              {status.drawdown ? `${t("accounts.used", { pct: Math.round(status.drawdown.used * 100) })} · ` : ""}
              {account.max_drawdown_pct}%
            </span>
          </div>
          {status.drawdown && <Bar fraction={status.drawdown.used} tone="loss" />}
        </div>
      )}

      {account.daily_loss_limit_pct != null && (
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-muted">{t("accounts.dailyLossLimit")}</span>
          <span className="text-ink">{account.daily_loss_limit_pct}%</span>
        </div>
      )}
    </div>
  );
}
