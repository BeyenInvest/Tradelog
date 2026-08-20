import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/Modal";
import { isMissed } from "@/lib/stats";
import { dateLocale } from "@/lib/format";
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

/** Sorted real trades first (Win, then Loss, then BE), still-running open trades after those, missed (hypothetical) trades last within their own outcome order — TradeListItem already dims/badges missed and open rows. */
function sortDayTrades(trades: Trade[]): Trade[] {
  const order = (t: Trade) => (t.outcome ? (OUTCOME_ORDER.get(t.outcome) ?? 0) : 99);
  return [...trades].sort((a, b) => {
    if (isMissed(a) !== isMissed(b)) return isMissed(a) ? 1 : -1;
    return order(a) - order(b);
  });
}

export function DayTradesModal({ dateIso, trades, onClose, onEdit, onDelete, onAddTrade }: DayTradesModalProps) {
  const { t, i18n } = useTranslation();
  const sorted = sortDayTrades(trades);
  const label = new Date(dateIso + "T00:00:00").toLocaleDateString(dateLocale(i18n.language), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Modal labelledBy="day-trades-title" maxWidthClass="max-w-2xl" onClose={onClose}>
      {(requestClose) => (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 id="day-trades-title" className="font-display text-xl italic text-ink capitalize">
              {label}
            </h2>
            <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
              <X size={18} />
            </button>
          </div>

          {sorted.length === 0 ? (
            <p className="text-sm text-muted py-4">{t("calendar.noTradesOnDay")}</p>
          ) : (
            <div className="overflow-x-auto mb-4">
              <div className="min-w-[640px]">
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
              <Plus size={15} /> {t("calendar.addTradeOnDay")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
