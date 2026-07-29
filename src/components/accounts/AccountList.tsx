import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Payout, PayoutInput, PropAccount } from "@/lib/types";
import { PayoutList } from "./PayoutList";

interface AccountListProps {
  accounts: PropAccount[];
  payouts: Payout[];
  onDeleteAccount: (id: string) => Promise<void>;
  onCreatePayout: (input: PayoutInput) => Promise<unknown>;
  onDeletePayout: (id: string) => Promise<void>;
}

export function AccountList({ accounts, payouts, onDeleteAccount, onCreatePayout, onDeletePayout }: AccountListProps) {
  if (accounts.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">Nog geen accounts.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {accounts.map((acc) => (
        <Card key={acc.id}>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-xl italic text-ink">{acc.naam}</p>
              <p className="font-mono text-xs mt-1 text-muted">
                €{acc.account_size.toLocaleString("nl-BE")} · {acc.fase}
                {!acc.actief && " · inactief"}
              </p>
            </div>
            <button onClick={() => void onDeleteAccount(acc.id)} className="p-1.5 rounded-md hover:bg-white/5 text-muted hover:text-loss">
              <Trash2 size={14} />
            </button>
          </div>
          <PayoutList
            accountId={acc.id}
            payouts={payouts.filter((p) => p.account_id === acc.id)}
            onCreate={onCreatePayout}
            onDelete={onDeletePayout}
          />
        </Card>
      ))}
    </div>
  );
}
