import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import { formatEUR } from "@/lib/format";
import { propAccountTypeLabel } from "@/lib/constants";
import type { Payout, PropAccount } from "@/lib/types";
import { PropFirmProgress } from "@/components/accounts/PropFirmProgress";

/** Read-only equivalent of AccountList — no edit/delete/payout-entry affordances, for the admin debug view. */
export function ReadOnlyAccountList({ accounts, payouts }: { accounts: PropAccount[]; payouts: Payout[] }) {
  const { t } = useTranslation();
  if (accounts.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">{t("accounts.noAccounts")}</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {accounts.map((acc) => {
        const accPayouts = payouts.filter((p) => p.account_id === acc.id);
        const total = accPayouts.reduce((s, p) => s + p.bedrag, 0);
        return (
          <Card key={acc.id}>
            <p className="font-display text-xl italic text-ink">{acc.naam}</p>
            <p className="font-mono text-xs mt-1 text-muted">
              €{formatEUR(acc.account_size)} · {propAccountTypeLabel(acc.fase, t)}
              {!acc.actief && ` · ${t("accounts.inactive")}`}
              {acc.current_pnl_pct != null && (
                <>
                  {" · "}
                  <span className={acc.current_pnl_pct > 0 ? "text-win" : acc.current_pnl_pct < 0 ? "text-loss" : ""}>
                    {acc.current_pnl_pct > 0 ? "+" : ""}
                    {acc.current_pnl_pct}% {t("accounts.pnlLabel")}
                  </span>
                </>
              )}
            </p>

            <PropFirmProgress account={acc} />

            <div className="flex flex-col gap-2 mt-3">
              <div className="flex items-center justify-between">
                <p className="font-body text-xs uppercase tracking-wider text-muted">{t("accounts.payouts")}</p>
                <span className="font-mono text-xs text-win">{t("accounts.payoutsTotal", { amount: formatEUR(total) })}</span>
              </div>
              {accPayouts.length === 0 ? (
                <p className="font-body text-xs text-muted">{t("accounts.noPayouts")}</p>
              ) : (
                accPayouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between font-mono text-xs py-1 border-b border-border-soft">
                    <span className="text-muted">{p.datum}</span>
                    <span className="text-win">€{formatEUR(p.bedrag)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
