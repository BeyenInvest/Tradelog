import { X } from "lucide-react";
import { useModalGuard } from "@/hooks/useModalGuard";
import { ReadOnlyTradeTable } from "@/components/admin/ReadOnlyTradeTable";
import type { Trade } from "@/lib/types";

/** Read-only equivalent of DayTradesModal — no edit/delete/add-trade affordances. */
export function ReadOnlyDayTradesModal({
  dateIso, trades, onClose, onSelectTrade,
}: {
  dateIso: string;
  trades: Trade[];
  onClose: () => void;
  onSelectTrade: (trade: Trade) => void;
}) {
  const { requestClose, containerRef } = useModalGuard<HTMLDivElement>(false, onClose);
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
        aria-labelledby="admin-day-trades-title"
        className="w-full max-w-2xl rounded-xl bg-surface border border-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="admin-day-trades-title" className="font-display text-xl italic text-ink capitalize">
            {label}
          </h2>
          <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
            <X size={18} />
          </button>
        </div>

        <ReadOnlyTradeTable trades={trades} onRowClick={onSelectTrade} />
      </div>
    </div>
  );
}
