import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ReadOnlyTradeTable } from "@/components/admin/ReadOnlyTradeTable";
import { dateLocale } from "@/lib/format";
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
  const { i18n } = useTranslation();
  const label = new Date(dateIso + "T00:00:00").toLocaleDateString(dateLocale(i18n.language), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Modal labelledBy="admin-day-trades-title" maxWidthClass="max-w-2xl" onClose={onClose}>
      {(requestClose) => (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 id="admin-day-trades-title" className="font-display text-xl italic text-ink capitalize">
              {label}
            </h2>
            <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
              <X size={18} />
            </button>
          </div>

          <ReadOnlyTradeTable trades={trades} onRowClick={onSelectTrade} />
        </>
      )}
    </Modal>
  );
}
