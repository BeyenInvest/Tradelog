import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import type { Payout, PayoutInput } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";
import { formatEUR } from "@/lib/format";
import { localTodayIso } from "@/lib/localDate";
import { useConfirm } from "@/hooks/useConfirm";

interface PayoutListProps {
  accountId: string;
  payouts: Payout[];
  onCreate: (input: PayoutInput) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}

export function PayoutList({ accountId, payouts, onCreate, onDelete }: PayoutListProps) {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const [bedrag, setBedrag] = useState("");
  const [datum, setDatum] = useState(localTodayIso);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const amount = Number(bedrag);
    if (!bedrag || !Number.isFinite(amount) || amount <= 0) {
      setError(t("accounts.amountRequired"));
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await onCreate({ account_id: accountId, bedrag: amount, datum, notes: null });
      setBedrag("");
    } catch (err) {
      setError(toErrorMessage(err, t("accounts.addPayoutFailed")));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(payout: Payout) {
    const ok = await confirm({
      title: t("common.deleteTitle"),
      message: t("accounts.deletePayoutConfirm", { amount: formatEUR(payout.bedrag), date: payout.datum }),
      tone: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    setError(null);
    try {
      await onDelete(payout.id);
    } catch (err) {
      setError(toErrorMessage(err, t("accounts.deletePayoutFailed")));
    }
  }

  const total = payouts.reduce((s, p) => s + p.bedrag, 0);

  return (
    <div className="flex flex-col gap-2 mt-3">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-wider text-muted">{t("accounts.payouts")}</p>
        <span className="font-mono text-xs text-win">{t("accounts.payoutsTotal", { amount: formatEUR(total) })}</span>
      </div>
      {payouts.map((p) => (
        <div key={p.id} className="flex items-center justify-between font-mono text-xs py-1 border-b border-border-soft">
          <span className="text-muted">{p.datum}</span>
          <span className="text-win">€{formatEUR(p.bedrag)}</span>
          <button onClick={() => void handleDelete(p)} className="p-1 rounded hover:bg-ink/5 text-muted hover:text-loss">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <form onSubmit={handleAdd} className="flex gap-2 mt-1">
        <input type="date" className="input text-xs py-1" value={datum} onChange={(e) => setDatum(e.target.value)} />
        <input
          type="number"
          step="0.01"
          min="0.01"
          placeholder={t("accounts.amountPlaceholder")}
          className="input text-xs py-1"
          value={bedrag}
          onChange={(e) => setBedrag(e.target.value)}
        />
        <button type="submit" disabled={adding} className="p-2 rounded-lg bg-surface-2 text-muted hover:text-ink">
          <Plus size={13} />
        </button>
      </form>
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
