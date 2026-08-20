import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, List as ListIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CalendarView } from "@/components/calendar/CalendarView";
import { ReadOnlyTradeTable } from "@/components/admin/ReadOnlyTradeTable";
import { ReadOnlyDayTradesModal } from "@/components/admin/ReadOnlyDayTradesModal";
import { ReadOnlyTradeDetailModal } from "@/components/admin/ReadOnlyTradeDetailModal";
import { takenTrades, closedTrades, missedTrades as filterMissedTrades } from "@/lib/stats";
import type { Trade } from "@/lib/types";

/**
 * Calendar/list toggle + day and trade drill-down modals, shared by the live-journal
 * section and the per-project view on AdminUserDetailPage — same trio of nested modals
 * as the owner-facing Journal, just without any edit/delete/add-trade affordances.
 */
export function ReadOnlyTradesViewer({
  trades,
  title,
  hideFase,
}: {
  trades: Trade[];
  title?: string;
  /** Share view (Fase M): honour the owner's hide_fase setting (the anonymous viewer has no profile of their own). */
  hideFase?: boolean;
}) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // Missed trades are hypothetical — they may never drive the calendar's day
  // coloring/sums, only its badge-only `missedTrades` overlay. The list and the
  // day modal keep showing them: those are per-trade rows without aggregation,
  // and the evaluation column labels each one as "Missed trade".
  const taken = useMemo(() => takenTrades(trades), [trades]);
  const missed = useMemo(() => filterMissedTrades(trades), [trades]);

  const selectedDayTrades = useMemo(
    () => (selectedDay ? trades.filter((t) => t.datum_open === selectedDay) : []),
    [trades, selectedDay]
  );

  return (
    <>
      <div className="flex items-center justify-between">
        {title && <h3 className="font-display text-lg italic text-ink">{title}</h3>}
        <div className="inline-flex rounded-lg border border-border overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-body transition-colors ${
              viewMode === "calendar" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            <CalendarDays size={14} /> {t("journal.viewCalendar")}
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-body transition-colors ${
              viewMode === "list" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            <ListIcon size={14} /> {t("journal.viewList")}
          </button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <CalendarView trades={closedTrades(taken)} missedTrades={closedTrades(missed)} onDayClick={setSelectedDay} />
      ) : (
        <Card>
          <ReadOnlyTradeTable trades={trades} onRowClick={setSelectedTrade} hideFase={hideFase} />
        </Card>
      )}

      {selectedDay && (
        <ReadOnlyDayTradesModal
          dateIso={selectedDay}
          trades={selectedDayTrades}
          onClose={() => setSelectedDay(null)}
          onSelectTrade={setSelectedTrade}
        />
      )}

      {selectedTrade && (
        <ReadOnlyTradeDetailModal trade={selectedTrade} hideFase={hideFase} onClose={() => setSelectedTrade(null)} />
      )}
    </>
  );
}
