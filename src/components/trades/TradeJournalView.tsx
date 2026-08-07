import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Upload, Eye, EyeOff, CalendarDays, List as ListIcon, CalendarClock, Flame, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { WinRatePieChart } from "@/components/charts/WinRatePieChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { DisciplineTrendChart } from "@/components/charts/DisciplineTrendChart";
import { CalendarView } from "@/components/calendar/CalendarView";
import { DayTradesModal } from "@/components/calendar/DayTradesModal";
import { TradeList } from "@/components/trades/TradeList";
import { TradeForm } from "@/components/trades/TradeForm";
import { ImportModal } from "@/components/trades/ImportModal";
import { PeriodPicker } from "@/components/trades/PeriodPicker";
import { FilterPanel } from "@/components/trades/FilterPanel";
import { type TradeScope, type TradesApi } from "@/hooks/useTrades";
import {
  computeOverviewKpis,
  computeDisciplineCurve,
  computeDisciplineStats,
  lastNChronological,
  takenTrades,
  missedTrades as filterMissedTrades,
} from "@/lib/stats";
import { applyJournalFilters, EMPTY_FILTERS, activeFilterCount, type JournalFilters } from "@/lib/tradeFilters";
import type { DateRange } from "@/lib/periodRanges";
import { toErrorMessage } from "@/lib/errorMessage";
import type { Trade } from "@/lib/types";

interface TradeJournalViewProps {
  scope: TradeScope;
  /** Owned by the page, not this component — see TradesApi on why it must be a single shared instance. */
  tradesApi: TradesApi;
  title: string;
  subtitle?: string;
}

/**
 * Calendar + KPI row + equity curve + win-rate gauge + trade list, fully scoped
 * to either the live Journal or a single backtest project — trades never leak
 * across scopes (enforced by useTrades' scope filter, not just UI hiding).
 *
 * The period picker + filter panel scope everything on this page (KPIs, charts,
 * calendar, list) to the selected date range/dimensions — one shared gate
 * (applyJournalFilters), not per-section filtering.
 *
 * Missed trades (trade_evaluation = "Missed trade", live scope only — a
 * backtest project never offers that option) carry a hypothetical outcome, so
 * they're excluded from KPIs/equity curve/calendar unconditionally — those
 * represent real performance and must never be diluted by a "what if". The
 * "toon missed trades" toggle only affects the trade list, where each one is
 * clearly badged, never the numbers.
 */
export function TradeJournalView({ scope, tradesApi, title, subtitle }: TradeJournalViewProps) {
  const { t } = useTranslation();
  const { trades, loading, error, createTrade, updateTrade, deleteTrade } = tradesApi;
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>(undefined);
  const [newTradeDate, setNewTradeDate] = useState<string | null>(null);
  const [showMissed, setShowMissed] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DateRange | null>(null);
  const [filters, setFilters] = useState<JournalFilters>(EMPTY_FILTERS);
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "sessies">("calendar");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Rolling window ("recent form"): null = all trades, else the last N. Live only.
  const [perfWindow, setPerfWindow] = useState<number | null>(null);
  // Which chart fills the shared equity/discipline card. Live only — a backtest
  // scope has no discipline trend, so it always shows the equity curve.
  const [chartPanel, setChartPanel] = useState<"equity" | "discipline">("equity");

  const isLive = scope.type === "live";
  const filtersActive = period !== null || activeFilterCount(filters) > 0;
  function resetFilters() {
    setPeriod(null);
    setFilters(EMPTY_FILTERS);
  }
  const scopedTrades = useMemo(() => applyJournalFilters(trades, period, filters), [trades, period, filters]);
  const realTrades = useMemo(() => takenTrades(scopedTrades), [scopedTrades]);
  const missedTrades = useMemo(() => filterMissedTrades(scopedTrades), [scopedTrades]);
  const missedCount = missedTrades.length;
  const listTrades = isLive && showMissed ? scopedTrades : realTrades;

  // Scopes only the performance snapshot (KPI row + win-rate + equity curve) to
  // the last N taken trades — never the calendar, list, or discipline trend
  // below (a trend chart is meaningless over a 20-trade window). Applied after
  // filters/period, so it's "the last N of the currently-filtered set".
  const windowedTrades = useMemo(
    () => (perfWindow == null ? realTrades : lastNChronological(realTrades, perfWindow)),
    [realTrades, perfWindow]
  );
  const kpis = useMemo(() => computeOverviewKpis(windowedTrades), [windowedTrades]);
  const disciplineData = useMemo(() => computeDisciplineCurve(realTrades), [realTrades]);
  const disciplineStats = useMemo(() => computeDisciplineStats(realTrades), [realTrades]);
  const selectedDayTrades = useMemo(
    () => (selectedDay ? scopedTrades.filter((t) => t.datum_open === selectedDay) : []),
    [scopedTrades, selectedDay]
  );

  function openCreate(dateIso?: string) {
    setEditingTrade(undefined);
    setNewTradeDate(dateIso ?? null);
    setFormOpen(true);
    setSelectedDay(null);
  }

  function openEdit(trade: Trade) {
    setEditingTrade(trade);
    setNewTradeDate(null);
    setFormOpen(true);
    setSelectedDay(null);
  }

  async function handleSubmit(input: Parameters<typeof createTrade>[0]) {
    if (editingTrade) {
      await updateTrade(editingTrade.id, input);
    } else {
      await createTrade(input);
    }
  }

  async function handleDelete(trade: Trade) {
    if (confirm(t("journal.deleteConfirm", { pair: trade.pair, date: trade.datum_open }))) {
      setDeleteError(null);
      try {
        await deleteTrade(trade.id);
      } catch (err) {
        setDeleteError(toErrorMessage(err, t("journal.deleteFailed")));
      }
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle ?? t("journal.tradesCount", { count: realTrades.length })}
        action={
          <div className="flex items-center gap-2">
            {isLive && (
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-surface-2 text-ink hover:bg-ink/5"
              >
                <Upload size={15} /> {t("journal.importTrades")}
                <span className="font-mono text-[9px] uppercase tracking-wider px-1 py-0.5 rounded border border-gold/50 text-gold">
                  Beta
                </span>
              </button>
            )}
            <button
              onClick={() => openCreate()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
            >
              <Plus size={15} /> {t("journal.newTrade")}
            </button>
          </div>
        }
      />

      {(error || deleteError) && (
        <Card className="mb-5 border-loss/40">
          <p className="text-sm text-loss">{error ?? deleteError}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">{t("common.loading")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker value={period} onChange={setPeriod} />
            <FilterPanel value={filters} onChange={setFilters} />

            <div className="sm:ml-auto flex flex-wrap items-center gap-3">
              {isLive && (
                <button
                  onClick={() => setShowMissed((v) => !v)}
                  disabled={missedCount === 0}
                  className="flex items-center gap-1.5 text-xs font-body text-muted hover:text-ink transition-colors disabled:opacity-40 disabled:hover:text-muted disabled:cursor-default"
                >
                  {showMissed ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showMissed ? t("journal.hideMissed") : t("journal.showMissed", { count: missedCount })}
                </button>
              )}
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-body transition-colors ${
                    viewMode === "calendar" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                  }`}
                >
                  <CalendarDays size={14} /> {t("journal.viewCalendar")}
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-body transition-colors ${
                    viewMode === "list" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                  }`}
                >
                  <ListIcon size={14} /> {t("journal.viewList")}
                </button>
                {!isLive && (
                  <button
                    onClick={() => setViewMode("sessies")}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-body transition-colors ${
                      viewMode === "sessies" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                    }`}
                  >
                    <CalendarClock size={14} /> {t("journal.viewSessions")}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {isLive && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="font-body text-xs uppercase tracking-wider text-muted">{t("journal.windowLabel")}</p>
                {/* Free-form window: type any N of recent trades. Empty/0/invalid → null (= all trades). */}
                <label className="flex items-center gap-2 font-body text-xs text-muted">
                  <span>{t("journal.windowLastLabel")}</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder={t("journal.windowAll")}
                    value={perfWindow ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === "") {
                        setPerfWindow(null);
                        return;
                      }
                      const n = Math.floor(Number(raw));
                      setPerfWindow(Number.isFinite(n) && n > 0 ? n : null);
                    }}
                    className="input text-xs py-1.5 w-20 text-center"
                  />
                  <span>{t("journal.windowTradesUnit")}</span>
                  <span className="text-faint">{t("journal.windowEmptyHint")}</span>
                </label>
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard label={t("journal.statTotalTrades")} value={kpis.totalTrades} />
            <StatCard
              label={t("journal.statResult")}
              value={`${kpis.totalResultaat > 0 ? "+" : ""}${kpis.totalResultaat}%`}
              tone={kpis.totalResultaat >= 0 ? "up" : "down"}
            />
            <StatCard
              label={t("journal.statAvgR")}
              value={kpis.avgR != null ? `${kpis.avgR > 0 ? "+" : ""}${kpis.avgR.toFixed(2)}R` : "—"}
              tone={kpis.avgR != null ? (kpis.avgR >= 0 ? "up" : "down") : "neutral"}
              sub={kpis.avgR != null ? t("journal.statTotalR", { total: kpis.totalR.toFixed(2) }) : undefined}
            />
            <StatCard
              label={t("journal.statMaxDrawdown")}
              value={`${kpis.maxDrawdownPct > 0 ? "-" : ""}${kpis.maxDrawdownPct}%`}
              tone={kpis.maxDrawdownPct > 0 ? "down" : "neutral"}
            />
            <Card className="flex items-center gap-3">
              <Flame size={16} className="text-loss" />
              <div>
                <p className="font-body text-xs uppercase tracking-wider text-muted">{t("journal.statStreaks")}</p>
                <p className="font-mono text-sm mt-1 text-ink">
                  {t("journal.maxLoss")} <span className="text-loss">{kpis.maxLosingStreak}</span> · {t("journal.maxWin")}{" "}
                  <span className="text-win">{kpis.maxWinningStreak}</span>
                </p>
              </div>
            </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="flex flex-col items-center justify-center">
              <h3 className="font-display text-xl italic mb-2 self-start text-ink">{t("journal.winRate")}</h3>
              <WinRatePieChart wins={kpis.wins} be={kpis.be} losses={kpis.losses} />
              <div className="flex gap-4 mt-3 font-mono text-xs">
                <span className="text-win">{kpis.wins}W</span>
                <span className="text-be">{kpis.be}BE</span>
                <span className="text-loss">{kpis.losses}L</span>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              {isLive ? (
                // Equity curve and discipline trend share one card, flipped by the
                // arrows — keeps the two related charts together without a second
                // full-width block cluttering the page.
                <>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => setChartPanel((p) => (p === "equity" ? "discipline" : "equity"))}
                        aria-label={t(
                          chartPanel === "equity" ? "journal.showDisciplineChart" : "journal.showEquityChart"
                        )}
                        className="shrink-0 rounded-md p-1 text-muted hover:text-ink hover:bg-surface-2 transition-colors"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <h3 className="font-display text-xl italic text-ink truncate">
                        {t(chartPanel === "equity" ? "journal.cumulativeResult" : "journal.disciplineTrend")}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setChartPanel((p) => (p === "equity" ? "discipline" : "equity"))}
                        aria-label={t(
                          chartPanel === "equity" ? "journal.showDisciplineChart" : "journal.showEquityChart"
                        )}
                        className="shrink-0 rounded-md p-1 text-muted hover:text-ink hover:bg-surface-2 transition-colors"
                      >
                        <ChevronRight size={18} />
                      </button>
                      <div className="ml-1 flex shrink-0 items-center gap-1" aria-hidden="true">
                        <span
                          className={`h-1.5 w-1.5 rounded-full transition-colors ${
                            chartPanel === "equity" ? "bg-gold" : "bg-border"
                          }`}
                        />
                        <span
                          className={`h-1.5 w-1.5 rounded-full transition-colors ${
                            chartPanel === "discipline" ? "bg-gold" : "bg-border"
                          }`}
                        />
                      </div>
                    </div>
                    {chartPanel === "discipline" && disciplineStats.rate != null && (
                      <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 font-mono text-xs">
                        <span className="text-ink">
                          {t("journal.disciplineRate", { pct: Math.round(disciplineStats.rate * 100) })}
                        </span>
                        <span className="text-win">
                          {t("journal.disciplineGood", { count: disciplineStats.good })}
                        </span>
                        {disciplineStats.emotional > 0 && (
                          <span className="text-loss">
                            {t("journal.disciplineEmotional", { count: disciplineStats.emotional })}
                          </span>
                        )}
                        {disciplineStats.technical > 0 && (
                          <span className="text-loss">
                            {t("journal.disciplineTechnical", { count: disciplineStats.technical })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {chartPanel === "equity" ? (
                    <EquityCurveChart trades={windowedTrades} />
                  ) : (
                    <DisciplineTrendChart data={disciplineData} />
                  )}
                </>
              ) : (
                <>
                  <h3 className="font-display text-xl italic mb-4 text-ink">{t("journal.cumulativeResult")}</h3>
                  <EquityCurveChart trades={windowedTrades} />
                </>
              )}
            </Card>
          </div>

          {viewMode === "calendar" ? (
            <CalendarView
              trades={realTrades}
              missedTrades={isLive && showMissed ? missedTrades : undefined}
              onDayClick={setSelectedDay}
            />
          ) : viewMode === "list" ? (
            <TradeList
              trades={listTrades}
              onEdit={openEdit}
              onDelete={handleDelete}
              title={t("journal.trades")}
              filtersActive={filtersActive}
              onResetFilters={resetFilters}
            />
          ) : (
            <TradeList
              trades={realTrades}
              onEdit={openEdit}
              onDelete={handleDelete}
              title={t("journal.backtestSessions")}
              filtersActive={filtersActive}
              onResetFilters={resetFilters}
              fixedGroupBy="backtestDag"
            />
          )}
        </div>
      )}

      {selectedDay && (
        <DayTradesModal
          dateIso={selectedDay}
          trades={selectedDayTrades}
          onClose={() => setSelectedDay(null)}
          onEdit={openEdit}
          onDelete={handleDelete}
          onAddTrade={openCreate}
        />
      )}

      {formOpen && (
        <TradeForm
          trade={editingTrade}
          onSubmit={handleSubmit}
          onClose={() => setFormOpen(false)}
          allowMissedTrade={isLive}
          initialDate={newTradeDate ?? undefined}
        />
      )}

      {importOpen && <ImportModal tradesApi={tradesApi} onClose={() => setImportOpen(false)} />}
    </>
  );
}
