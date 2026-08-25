import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Upload, Zap, Share2, Eye, EyeOff, CalendarDays, List as ListIcon, CalendarClock, Flame, ChevronLeft, ChevronRight } from "lucide-react";
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
import { QuickLogForm } from "@/components/trades/QuickLogForm";
import { ImportModal } from "@/components/trades/ImportModal";
import { ShareJournalModal } from "@/components/share/ShareJournalModal";
import { JournalEmptyState } from "@/components/trades/JournalEmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PeriodPicker } from "@/components/trades/PeriodPicker";
import { FilterPanel } from "@/components/trades/FilterPanel";
import { type TradeScope, type TradesApi } from "@/hooks/useTrades";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import {
  computeOverviewKpis,
  computeDisciplineCurve,
  computeDisciplineStats,
  computeExtremes,
  computeRDistribution,
  computeAvgRiskPct,
  lastNChronological,
  round2,
  takenTrades,
  closedTrades,
  missedTrades as filterMissedTrades,
} from "@/lib/stats";
import { formatAggregate, resultInUnit } from "@/lib/format";
import { applyJournalFilters, EMPTY_FILTERS, activeFilterCount, type JournalFilters } from "@/lib/tradeFilters";
import { AvgRStatCard, MaxDrawdownStatCard, ProfitFactorStatCard, ResultStatCard } from "@/components/trades/JournalKpiCards";
import { useResultDisplay } from "@/hooks/useResultDisplay";
import type { DateRange } from "@/lib/periodRanges";
import { toErrorMessage } from "@/lib/errorMessage";
import type { Trade } from "@/lib/types";

interface TradeJournalViewProps {
  scope: TradeScope;
  /** Owned by the page, not this component — see TradesApi on why it must be a single shared instance. */
  tradesApi: TradesApi;
  title: string;
  subtitle?: string;
  /**
   * First-run onboarding config — passed only for the live Journal (JournalPage).
   * When present and the journal has zero trades, the KPI row/charts/toolbar are
   * replaced by a JournalEmptyState wayfinder. A backtest project never gets this.
   */
  onboarding?: { hasFields: boolean; showPresetPicker: boolean };
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
export function TradeJournalView({ scope, tradesApi, title, subtitle, onboarding }: TradeJournalViewProps) {
  const { t } = useTranslation();
  // Soft-launch gate: Fase-E additions (profit factor, current-streak line) stay hidden
  // from the live users until public launch — only owner/beta accounts see them.
  const { betaFeatures, profile } = useAuth();
  const { trackExit } = useMethodology();
  const { unit: resultUnit, saldo } = useResultDisplay();
  const { trades, loading, error, createTrade, updateTrade, deleteTrade } = tradesApi;
  const [formOpen, setFormOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>(undefined);
  const [newTradeDate, setNewTradeDate] = useState<string | null>(null);
  const [showMissed, setShowMissed] = useState(false);
  const [deletingTrade, setDeletingTrade] = useState<Trade | null>(null);
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
  // First-run empty state: an untouched live journal (zero trades in the whole
  // book, before any filter). Replaces the all-zero KPI row/charts with a wayfinder.
  const showOnboarding = onboarding != null && trades.length === 0;
  const filtersActive = period !== null || activeFilterCount(filters) > 0;
  function resetFilters() {
    setPeriod(null);
    setFilters(EMPTY_FILTERS);
  }
  const scopedTrades = useMemo(() => applyJournalFilters(trades, period, filters), [trades, period, filters]);
  // takenList = shown in the trade list (includes still-running open trades, badged);
  // realTrades = the realized-performance set for KPIs/charts/calendar (open trades
  // excluded via closedTrades, on top of the missed-trade exclusion of takenTrades).
  const takenList = useMemo(() => takenTrades(scopedTrades), [scopedTrades]);
  const realTrades = useMemo(() => closedTrades(takenList), [takenList]);
  // Still-running trades in scope — shown as neutral grey markers on the calendar
  // (they carry no result, so they never color a day or reach the KPIs).
  const openScoped = useMemo(() => takenList.filter((t) => t.is_open), [takenList]);
  const missedTrades = useMemo(() => filterMissedTrades(scopedTrades), [scopedTrades]);
  const missedCount = missedTrades.length;
  const listTrades = isLive && showMissed ? scopedTrades : takenList;

  // Scopes only the performance snapshot (KPI row + win-rate + equity curve) to
  // the last N taken trades — never the calendar, list, or discipline trend
  // below (a trend chart is meaningless over a 20-trade window). Applied after
  // filters/period, so it's "the last N of the currently-filtered set".
  const windowedTrades = useMemo(
    () => (perfWindow == null ? realTrades : lastNChronological(realTrades, perfWindow)),
    [realTrades, perfWindow]
  );
  const kpis = useMemo(() => computeOverviewKpis(windowedTrades), [windowedTrades]);
  // Extra KPI-cards (Fase S1) — computed from the same windowed set as the KPI row,
  // straight from the R-fase stats-motor (no new math here, only wiring).
  const extremes = useMemo(() => computeExtremes(windowedTrades), [windowedTrades]);
  const rDist = useMemo(() => computeRDistribution(windowedTrades), [windowedTrades]);
  const avgRiskPct = useMemo(() => computeAvgRiskPct(windowedTrades), [windowedTrades]);
  // Largest win/loss shown in the chosen result-eenheid: the extreme is a single
  // trade's %, so re-read that exact trade through resultInUnit (R needs its own risk).
  const largestWinVal = useMemo(() => {
    const tr = extremes.largestWinTradeId ? windowedTrades.find((t) => t.id === extremes.largestWinTradeId) : null;
    return tr ? round2(resultInUnit(tr, resultUnit, saldo)) : null;
  }, [extremes.largestWinTradeId, windowedTrades, resultUnit, saldo]);
  const largestLossVal = useMemo(() => {
    const tr = extremes.largestLossTradeId ? windowedTrades.find((t) => t.id === extremes.largestLossTradeId) : null;
    return tr ? round2(resultInUnit(tr, resultUnit, saldo)) : null;
  }, [extremes.largestLossTradeId, windowedTrades, resultUnit, saldo]);
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

  async function confirmDelete() {
    const trade = deletingTrade;
    if (!trade) return;
    setDeletingTrade(null);
    setDeleteError(null);
    try {
      await deleteTrade(trade.id);
    } catch (err) {
      setDeleteError(toErrorMessage(err, t("journal.deleteFailed")));
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle ?? t("journal.tradesCount", { count: realTrades.length })}
        action={
          // During the first-run empty state the wayfinder card owns the CTAs — a
          // duplicate New trade / Import in the header would just be noise.
          showOnboarding ? undefined : (
          <div className="flex items-center gap-2">
            {/* Import is still Beta (untested against real broker exports) and since
                Fase I also opens inside backtest projects (TradingView backtests land
                there) — soft-launch rule: beta accounts only, until validated. */}
            {betaFeatures && (
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg font-body text-sm font-medium bg-surface-2 text-ink hover:bg-ink/5"
              >
                <Upload size={15} /> {t("journal.importTrades")}
                <span className="font-mono text-[9px] uppercase tracking-wider px-1 py-0.5 rounded border border-gold/50 text-gold">
                  Beta
                </span>
              </button>
            )}
            {/* Quick-log (Fase L): a trade in <30s, details later. Live journal
                only (a backtest logs full sessions). Icon-only + tooltip so it
                stays a light accent next to the primary "New trade" CTA rather
                than a competing full-size button. */}
            {/* Share-links (Fase M): read-only coach view via token-URL. Managing
                links is beta-gated (gating-regel) and live-journal only — the
                token view itself is per-token, not per-user. Same icon-button
                treatment as quick-log to keep the header calm. */}
            {betaFeatures && isLive && profile && (
              <button
                onClick={() => setShareOpen(true)}
                title={t("share.button")}
                aria-label={t("share.button")}
                className="flex items-center justify-center h-9 px-3 rounded-lg bg-surface-2 text-muted hover:text-ink hover:bg-ink/5 transition-colors"
              >
                <Share2 size={16} />
              </button>
            )}
            {/* Quick-log (Fase L): a trade in <30s, details later. Live journal
                only. Icon-only + tooltip so it stays a light accent next to the
                primary "New trade" CTA rather than a competing full-size button. */}
            {isLive && (
              <button
                onClick={() => setQuickOpen(true)}
                title={t("quickLog.button")}
                aria-label={t("quickLog.button")}
                className="flex items-center justify-center h-9 px-3 rounded-lg bg-surface-2 text-muted hover:text-ink hover:bg-ink/5 transition-colors"
              >
                <Zap size={16} />
              </button>
            )}
            <button
              onClick={() => openCreate()}
              className="flex items-center gap-2 h-9 px-4 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
            >
              <Plus size={15} /> {t("journal.newTrade")}
            </button>
          </div>
          )
        }
      />

      {(error || deleteError) && (
        <Card className="mb-5 border-loss/40">
          <p className="text-sm text-loss">{error ?? deleteError}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">{t("common.loading")}</p>
      ) : showOnboarding ? (
        <JournalEmptyState
          hasFields={onboarding.hasFields}
          showPresetPicker={onboarding.showPresetPicker}
          showImport={betaFeatures}
          onNewTrade={() => openCreate()}
          onImport={() => setImportOpen(true)}
        />
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label={t("journal.statTotalTrades")} value={kpis.totalTrades} />
            <ResultStatCard kpis={kpis} unit={resultUnit} saldo={saldo} />
            <ProfitFactorStatCard kpis={kpis} />
            <AvgRStatCard kpis={kpis} />
            <MaxDrawdownStatCard kpis={kpis} />
            <Card className="flex items-center gap-3">
              <Flame size={16} className="text-loss" />
              <div className="min-w-0">
                <p className="font-body text-xs uppercase tracking-wider text-muted">{t("journal.statStreaks")}</p>
                <p className="font-mono text-sm mt-1 text-ink">
                  {t("journal.maxLoss")} <span className="text-loss">{kpis.maxLosingStreak}</span> · {t("journal.maxWin")}{" "}
                  <span className="text-win">{kpis.maxWinningStreak}</span>
                </p>
                <p className="font-mono text-xs mt-1 text-muted">
                  {t("journal.currentStreak")}:{" "}
                  {kpis.currentStreak.type === "none" ? (
                    <span className="text-faint">—</span>
                  ) : (
                    <span
                      className={
                        kpis.currentStreak.type === "Win"
                          ? "text-win"
                          : kpis.currentStreak.type === "Loss"
                            ? "text-loss"
                            : "text-be"
                      }
                    >
                      {kpis.currentStreak.count}{" "}
                      {t(`journal.streakType_${kpis.currentStreak.type}`)}
                    </span>
                  )}
                </p>
              </div>
            </Card>

            {/* Extremes: largest single win & loss in one card (Fase S1). */}
            <Card>
              <p className="font-body text-xs uppercase tracking-wider text-muted">{t("journal.statExtremes")}</p>
              <p className="font-mono text-sm mt-2 text-ink">
                <span className="text-win">
                  {largestWinVal != null ? formatAggregate(largestWinVal, resultUnit) : "—"}
                </span>{" "}
                <span className="text-faint">/</span>{" "}
                <span className="text-loss">
                  {largestLossVal != null ? formatAggregate(largestLossVal, resultUnit) : "—"}
                </span>
              </p>
              <p className="font-body text-xs mt-1 text-muted">{t("journal.statExtremesSub")}</p>
            </Card>

            <StatCard
              label={t("journal.statAvgRisk")}
              value={avgRiskPct != null ? `${avgRiskPct}%` : "—"}
            />

            {/* System Quality Number + spread of the R-distribution (always R-based,
                the metric is defined on R-multiples). Part of the advanced-analysis
                opt-in (0050) — hidden unless the journal turned the layer on. */}
            {trackExit && (
              <StatCard
                label={t("journal.statSqn")}
                value={rDist.sqn != null ? rDist.sqn.toFixed(2) : "—"}
                tone={rDist.sqn != null ? (rDist.sqn >= 2 ? "up" : rDist.sqn < 1 ? "down" : "neutral") : "neutral"}
                sub={rDist.stdDevR != null ? t("journal.statStdDev", { sd: rDist.stdDevR.toFixed(2) }) : undefined}
              />
            )}
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
              {kpis.winRateExclBe != null && (
                <p className="mt-2 font-mono text-[11px] text-muted">
                  {t("journal.winRateExclBe", { pct: (kpis.winRateExclBe * 100).toFixed(0) })}
                </p>
              )}
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
              missedTrades={isLive && showMissed ? closedTrades(missedTrades) : undefined}
              openTrades={openScoped}
              onDayClick={setSelectedDay}
            />
          ) : viewMode === "list" ? (
            <TradeList
              trades={listTrades}
              onEdit={openEdit}
              onDelete={setDeletingTrade}
              title={t("journal.trades")}
              filtersActive={filtersActive}
              onResetFilters={resetFilters}
            />
          ) : (
            <TradeList
              trades={realTrades}
              onEdit={openEdit}
              onDelete={setDeletingTrade}
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
          onDelete={setDeletingTrade}
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

      {quickOpen && (
        <QuickLogForm
          onSubmit={async (input) => {
            await createTrade(input);
          }}
          onClose={() => setQuickOpen(false)}
        />
      )}

      {importOpen && <ImportModal tradesApi={tradesApi} scope={scope} onClose={() => setImportOpen(false)} />}

      {shareOpen && profile && (
        // Keyed by journal: ShareLinksModal fetches its list once on mount, so if the
        // active journal ever changes while open, a remount keeps list and create in sync.
        <ShareJournalModal
          key={profile.methodology_id ?? "legacy"}
          userId={profile.id}
          methodologyId={profile.methodology_id ?? null}
          onClose={() => setShareOpen(false)}
        />
      )}

      {deletingTrade && (
        <ConfirmDialog
          title={t("journal.deleteTitle")}
          message={t("journal.deleteConfirm", {
            pair: deletingTrade.instrument ?? deletingTrade.pair,
            date: deletingTrade.datum_open,
          })}
          confirmLabel={t("common.delete")}
          tone="danger"
          onConfirm={confirmDelete}
          onClose={() => setDeletingTrade(null)}
        />
      )}
    </>
  );
}
