import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Payout, PayoutInput } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";

interface PayoutListProps {
  accountId: string;
  payouts: Payout[];
  onCreate: (input: PayoutInput) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}

export function PayoutList({ accountId, payouts, onCreate, onDelete }: PayoutListProps) {
  const [bedrag, setBedrag] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!bedrag) return;
    setAdding(true);
    setError(null);
    try {
      await onCreate({ account_id: accountId, bedrag: Number(bedrag), datum, notes: null });
      setBedrag("");
    } catch (err) {
      setError(toErrorMessage(err, "Toevoegen van payout is mislukt"));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(toErrorMessage(err, "Verwijderen van payout is mislukt"));
    }
  }

  const total = payouts.reduce((s, p) => s + p.bedrag, 0);

  return (
    <div className="flex flex-col gap-2 mt-3">
      <div className="flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-wider text-muted">Payouts</p>
        <span className="font-mono text-xs text-win">totaal €{total.toFixed(2)}</span>
      </div>
      {payouts.map((p) => (
        <div key={p.id} className="flex items-center justify-between font-mono text-xs py-1 border-b border-border-soft">
          <span className="text-muted">{p.datum}</span>
          <span className="text-win">€{p.bedrag.toFixed(2)}</span>
          <button onClick={() => void handleDelete(p.id)} className="p-1 rounded hover:bg-ink/5 text-muted hover:text-loss">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <form onSubmit={handleAdd} className="flex gap-2 mt-1">
        <input type="date" className="input text-xs py-1" value={datum} onChange={(e) => setDatum(e.target.value)} />
        <input
          type="number"
          step="0.01"
          placeholder="bedrag"
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
