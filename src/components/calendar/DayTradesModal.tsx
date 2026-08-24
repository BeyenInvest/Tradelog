import { Plus, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/Modal";
import { closedTrades, computeOutcomeCounts, isMissed, round2, takenTrades } from "@/lib/stats";
import { dateLocale, formatAggregate, resultInUnit } from "@/lib/format";
import { OUTCOMES } from "@/lib/constants";
import type { Trade } from "@/lib/types";
import { useResultDisplay } from "@/hooks/useResultDisplay";
import { useMethodology } from "@/hooks/useMethodology";
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
  const { unit: resultUnit, saldo } = useResultDisplay();
  const { isLegacyMethodology } = useMethodology();
  const columnMode = isLegacyMethodology ? "legacy" : "modern";
  const sorted = sortDayTrades(trades);
  const label = new Date(dateIso + "T00:00:00").toLocaleDateString(dateLocale(i18n.language), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Day KPI header (Fase S1): realized snapshot of this single day. Missed
  // (hypothetical) and still-running open trades are excluded — same real-
  // performance contract as everywhere else.
  const realDay = useMemo(() => closedTrades(takenTrades(trades)), [trades]);
  const dayStats = useMemo(() => {
    const counts = computeOutcomeCounts(realDay);
    const net = round2(realDay.reduce((s, t) => s + resultInUnit(t, resultUnit, saldo), 0));
    // Win rate excluding BE (wins / decisive) — the honest day read; null when
    // the day has no decided trade yet.
    const decisive = counts.wins + counts.losses;
    const winRate = decisive > 0 ? Math.round((counts.wins / decisive) * 100) : null;
    return { counts, net, winRate };
  }, [realDay, resultUnit, saldo]);
  const netTone = dayStats.net > 0 ? "text-win" : dayStats.net < 0 ? "text-loss" : "text-be";

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

          {realDay.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border border-border-soft bg-surface-2/40 px-3 py-2">
                <p className="font-body text-[11px] uppercase tracking-wider text-muted">{t("calendar.dayNet")}</p>
                <p className={`font-mono text-lg mt-0.5 ${netTone}`}>
                  {formatAggregate(dayStats.net, resultUnit, { decimals: resultUnit === "currency" ? 0 : 1 })}
                </p>
              </div>
              <div className="rounded-lg border border-border-soft bg-surface-2/40 px-3 py-2">
                <p className="font-body text-[11px] uppercase tracking-wider text-muted">{t("calendar.dayTrades")}</p>
                <p className="font-mono text-lg mt-0.5 text-ink">{dayStats.counts.n}</p>
                <p className="font-mono text-[11px] text-muted">
                  <span className="text-win">{dayStats.counts.wins}W</span> ·{" "}
                  <span className="text-be">{dayStats.counts.be}BE</span> ·{" "}
                  <span className="text-loss">{dayStats.counts.losses}L</span>
                </p>
              </div>
              <div className="rounded-lg border border-border-soft bg-surface-2/40 px-3 py-2">
                <p className="font-body text-[11px] uppercase tracking-wider text-muted">{t("calendar.dayWinRate")}</p>
                <p className="font-mono text-lg mt-0.5 text-ink">
                  {dayStats.winRate != null ? `${dayStats.winRate}%` : "—"}
                </p>
              </div>
            </div>
          )}

          {sorted.length === 0 ? (
            <p className="text-sm text-muted py-4">{t("calendar.noTradesOnDay")}</p>
          ) : (
            <div className="overflow-x-auto mb-4">
              <div className="min-w-[640px]">
                <TradeListHeader columnMode={columnMode} />
                {sorted.map((t) => (
                  <TradeListItem key={t.id} trade={t} onEdit={onEdit} onDelete={onDelete} columnMode={columnMode} />
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
