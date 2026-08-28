import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/hooks/useConfirm";
import type { Payout, PayoutInput, PropAccount, PropAccountInput } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";
import { formatEUR } from "@/lib/format";
import { propAccountTypeLabel } from "@/lib/constants";
import { PayoutList } from "./PayoutList";
import { PropFirmProgress } from "./PropFirmProgress";

interface AccountListProps {
  accounts: PropAccount[];
  payouts: Payout[];
  onDeleteAccount: (id: string) => Promise<void>;
  onUpdateAccount: (id: string, input: Partial<PropAccountInput>) => Promise<unknown>;
  onCreatePayout: (input: PayoutInput) => Promise<unknown>;
  onDeletePayout: (id: string) => Promise<void>;
}

function PnlPctField({ account, onUpdate }: { account: PropAccount; onUpdate: AccountListProps["onUpdateAccount"] }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(account.current_pnl_pct?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && !Number.isFinite(parsed)) {
      setError(t("accounts.invalidPct"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdate(account.id, { current_pnl_pct: parsed });
    } catch (err) {
      setError(toErrorMessage(err, t("accounts.savePnlFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-2 mt-2">
      <label className="text-xs uppercase tracking-wider text-muted">{t("accounts.runningPnl")}</label>
      <input type="number" step="0.01" placeholder="—" className="input text-xs py-1 w-20" value={value} onChange={(e) => setValue(e.target.value)} />
      <span className="text-xs text-muted">%</span>
      <button type="submit" disabled={saving} className="px-2 py-1 rounded-md text-xs bg-surface-2 text-muted hover:text-ink">
        {t("common.save")}
      </button>
      {error && <span className="text-xs text-loss">{error}</span>}
    </form>
  );
}

/**
 * Active toggle (M2-a): the €-saldo the whole app displays against is the
 * active account (ordered actief desc, created_at desc in useResultDisplay), so
 * with more than one account the user needs a way to pick which one drives it —
 * otherwise a second account silently rescales every € amount. Toggling fires
 * onUpdateAccount, which refreshes the saldo (PROP_ACCOUNTS_CHANGED_EVENT).
 */
function ActiveToggle({ account, onUpdate }: { account: PropAccount; onUpdate: AccountListProps["onUpdateAccount"] }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      await onUpdate(account.id, { actief: !account.actief });
    } catch {
      // Optimistic-free: on failure the shared state is untouched, so the pill
      // just stays as it was — no local error surface needed for a one-field flip.
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={saving}
      title={account.actief ? t("accounts.setInactive") : t("accounts.setActive")}
      aria-pressed={account.actief}
      className={`shrink-0 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border transition-colors disabled:opacity-60 ${
        account.actief
          ? "border-win/40 bg-win/10 text-win hover:bg-win/15"
          : "border-border bg-surface-2 text-muted hover:text-ink"
      }`}
    >
      {account.actief ? t("accounts.active") : t("accounts.inactive")}
    </button>
  );
}

/** Inline editor for an account's three prop-firm rule %s. Blank field = null (rule not set). */
function PropFirmRulesField({ account, onUpdate }: { account: PropAccount; onUpdate: AccountListProps["onUpdateAccount"] }) {
  const { t } = useTranslation();
  const [target, setTarget] = useState(account.profit_target_pct?.toString() ?? "");
  const [drawdown, setDrawdown] = useState(account.max_drawdown_pct?.toString() ?? "");
  const [daily, setDaily] = useState(account.daily_loss_limit_pct?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Blank → null; otherwise a finite number > 0 (matches the DB check on each column).
  function parseRule(raw: string): number | null | undefined {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : undefined; // undefined = invalid
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const profit_target_pct = parseRule(target);
    const max_drawdown_pct = parseRule(drawdown);
    const daily_loss_limit_pct = parseRule(daily);
    if (profit_target_pct === undefined || max_drawdown_pct === undefined || daily_loss_limit_pct === undefined) {
      setError(t("accounts.invalidPct"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdate(account.id, { profit_target_pct, max_drawdown_pct, daily_loss_limit_pct });
    } catch (err) {
      setError(toErrorMessage(err, t("accounts.saveRulesFailed")));
    } finally {
      setSaving(false);
    }
  }

  const inputs: { label: string; value: string; set: (v: string) => void }[] = [
    { label: t("accounts.profitTarget"), value: target, set: setTarget },
    { label: t("accounts.maxDrawdown"), value: drawdown, set: setDrawdown },
    { label: t("accounts.dailyLossLimit"), value: daily, set: setDaily },
  ];

  return (
    <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2 mt-3">
      {inputs.map((f) => (
        <div key={f.label} className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-muted">{f.label}</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="—"
              className="input text-xs py-1 w-16"
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
            />
            <span className="text-xs text-muted">%</span>
          </div>
        </div>
      ))}
      <button type="submit" disabled={saving} className="px-2 py-1 rounded-md text-xs bg-surface-2 text-muted hover:text-ink">
        {t("common.save")}
      </button>
      {error && <span className="text-xs text-loss self-center">{error}</span>}
    </form>
  );
}

export function AccountList({ accounts, payouts, onDeleteAccount, onUpdateAccount, onCreatePayout, onDeletePayout }: AccountListProps) {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteAccount(acc: PropAccount) {
    const ok = await confirm({
      title: t("common.deleteTitle"),
      message: t("accounts.deleteConfirm", { name: acc.naam }),
      tone: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    setError(null);
    try {
      await onDeleteAccount(acc.id);
    } catch (err) {
      setError(toErrorMessage(err, t("accounts.deleteFailed")));
    }
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">{t("accounts.noAccounts")}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {confirmDialog}
      {error && <p className="text-sm text-loss">{error}</p>}
      {accounts.length > 1 && <p className="text-xs text-muted">{t("accounts.activeHint")}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {accounts.map((acc) => (
          <Card key={acc.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-xl italic text-ink">{acc.naam}</p>
                <p className="font-mono text-xs mt-1 text-muted">
                  €{formatEUR(acc.account_size)} · {propAccountTypeLabel(acc.fase, t)}
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
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ActiveToggle account={acc} onUpdate={onUpdateAccount} />
                <button onClick={() => void handleDeleteAccount(acc)} className="p-1.5 rounded-md hover:bg-ink/5 text-muted hover:text-loss">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <PnlPctField account={acc} onUpdate={onUpdateAccount} />
            <PropFirmProgress account={acc} />
            <PropFirmRulesField account={acc} onUpdate={onUpdateAccount} />
            <PayoutList
              accountId={acc.id}
              payouts={payouts.filter((p) => p.account_id === acc.id)}
              onCreate={onCreatePayout}
              onDelete={onDeletePayout}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
