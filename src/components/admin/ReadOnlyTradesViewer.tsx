import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, List as ListIcon, CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CalendarView } from "@/components/calendar/CalendarView";
import { ReadOnlyTradeTable } from "@/components/admin/ReadOnlyTradeTable";
import { ReadOnlyDayTradesModal } from "@/components/admin/ReadOnlyDayTradesModal";
import { ReadOnlyTradeDetailModal } from "@/components/admin/ReadOnlyTradeDetailModal";
import { takenTrades, closedTrades, missedTrades as filterMissedTrades } from "@/lib/stats";
import { groupTrades } from "@/lib/tradeGrouping";
import { dateLocale, formatResult, groupResultCtx, resultDisplayValue } from "@/lib/format";
import { useResultDisplay } from "@/hooks/useResultDisplay";
import type { ReadOnlyJournalMeta, SharedMethodologyField, Trade } from "@/lib/types";

/**
 * Calendar/list toggle + day and trade drill-down modals, shared by the live-journal
 * section and the per-project view on AdminUserDetailPage — same trio of nested modals
 * as the owner-facing Journal, just without any edit/delete/add-trade affordances.
 */
export function ReadOnlyTradesViewer({
  trades,
  title,
  fields,
  allowSessions = false,
  journalOf,
}: {
  trades: Trade[];
  title?: string;
  /** Share view (0042): the shared journal's field definitions, so the detail modal can label trades.custom values. */
  fields?: SharedMethodologyField[];
  /** Backtest context only: offer the "Per sessie" grouping (trades bucketed by the day they were logged), mirroring the members' backtest journal. */
  allowSessions?: boolean;
  /** Admin only: the journal a trade was logged in — switches the detail modal to the full view (every field, like the owner's own form). */
  journalOf?: (trade: Trade) => ReadOnlyJournalMeta | undefined;
}) {
  const { t, i18n } = useTranslation();
  const { unit, saldo } = useResultDisplay();
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "sessies">("calendar");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // A "session" = the calendar day the trades were logged (created_at), newest first —
  // exactly the members' backtest-sessie view (fixedGroupBy="backtestDag"), read-only.
  const sessionGroups = useMemo(
    () => groupTrades(trades, "backtestDag", dateLocale(i18n.language)).sort((a, b) => (a.key < b.key ? 1 : -1)),
    [trades, i18n.language]
  );

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
          {allowSessions && (
            <button
              onClick={() => setViewMode("sessies")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-body transition-colors ${
                viewMode === "sessies" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              <CalendarClock size={14} /> {t("journal.viewSessions")}
            </button>
          )}
        </div>
      </div>

      {viewMode === "calendar" ? (
        <CalendarView trades={closedTrades(taken)} missedTrades={closedTrades(missed)} openTrades={taken.filter((tr) => tr.is_open)} onDayClick={setSelectedDay} />
      ) : viewMode === "list" ? (
        <Card>
          <ReadOnlyTradeTable trades={trades} onRowClick={setSelectedTrade} />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {sessionGroups.length === 0 ? (
            <Card>
              <p className="font-body text-sm text-muted">{t("reviews.noTradesShort")}</p>
            </Card>
          ) : (
            sessionGroups.map((g) => {
              const ctx = groupResultCtx(g.trades, g.resultaatTotal, unit, saldo);
              const total = resultDisplayValue(g.resultaatTotal, unit, ctx);
              return (
                <Card key={g.key} className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="font-display text-base italic text-ink capitalize">{g.label}</h4>
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-muted">{t("journal.tradesCount", { count: g.trades.length })}</span>
                      <span className={total > 0 ? "text-win" : total < 0 ? "text-loss" : "text-be"}>
                        {formatResult(g.resultaatTotal, unit, ctx)}
                      </span>
                    </div>
                  </div>
                  <ReadOnlyTradeTable trades={g.trades} onRowClick={setSelectedTrade} />
                </Card>
              );
            })
          )}
        </div>
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
        <ReadOnlyTradeDetailModal
          trade={selectedTrade}
          fields={fields}
          journal={journalOf?.(selectedTrade)}
          onClose={() => setSelectedTrade(null)}
        />
      )}
    </>
  );
}
