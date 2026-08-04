import { Plus, X } from "lucide-react";
import { useModalGuard } from "@/hooks/useModalGuard";
import { isMissed } from "@/lib/stats";
import { OUTCOMES } from "@/lib/constants";
import type { Trade } from "@/lib/types";
import { TradeListHeader } from "@/components/trades/TradeListHeader";
import { TradeListItem } from "@/components/trades/TradeListItem";

const OUTCOME_ORDER = new Map(OUTCOMES.map((o, i) => [o, i]));

interface DayTradesModalProps {
  dateIso: string;
  trades: Trade[];
  onClose: () => void;
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
  onAddTrade: (dateIso: string) => void;
}

/** Sorted real trades first (Win, then Loss, then BE), missed (hypothetical) trades last within their own outcome order — TradeListItem already dims/badges missed rows. */
function sortDayTrades(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    if (isMissed(a) !== isMissed(b)) return isMissed(a) ? 1 : -1;
    return (OUTCOME_ORDER.get(a.outcome) ?? 0) - (OUTCOME_ORDER.get(b.outcome) ?? 0);
  });
}

export function DayTradesModal({ dateIso, trades, onClose, onEdit, onDelete, onAddTrade }: DayTradesModalProps) {
  const { requestClose, containerRef } = useModalGuard<HTMLDivElement>(false, onClose);
  const sorted = sortDayTrades(trades);
  const label = new Date(dateIso + "T00:00:00").toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={requestClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-trades-title"
        className="w-full max-w-2xl rounded-xl bg-surface border border-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="day-trades-title" className="font-display text-xl italic text-ink capitalize">
            {label}
          </h2>
          <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
            <X size={18} />
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-muted py-4">Geen trades op deze dag.</p>
        ) : (
          <div className="overflow-x-auto mb-4">
            <div className="min-w-[560px]">
              <TradeListHeader />
              {sorted.map((t) => (
                <TradeListItem key={t.id} trade={t} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => onAddTrade(dateIso)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
          >
            <Plus size={15} /> Trade toevoegen op deze dag
          </button>
        </div>
      </div>
    </div>
  );
}
