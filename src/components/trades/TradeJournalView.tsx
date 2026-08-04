import { useMemo, useState } from "react";
import { Plus, Eye, EyeOff, CalendarDays, List as ListIcon, Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { WinRatePieChart } from "@/components/charts/WinRatePieChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { CalendarView } from "@/components/calendar/CalendarView";
import { TradeList } from "@/components/trades/TradeList";
import { TradeForm } from "@/components/trades/TradeForm";
import { PeriodPicker } from "@/components/trades/PeriodPicker";
import { FilterPanel } from "@/components/trades/FilterPanel";
import { type TradeScope, type TradesApi } from "@/hooks/useTrades";
import { computeOverviewKpis, computeEquityCurve, takenTrades, missedTrades as filterMissedTrades } from "@/lib/stats";
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
  const { trades, loading, error, createTrade, updateTrade, deleteTrade } = tradesApi;
  const [formOpen, setFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>(undefined);
  const [showMissed, setShowMissed] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DateRange | null>(null);
  const [filters, setFilters] = useState<JournalFilters>(EMPTY_FILTERS);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

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

  const kpis = useMemo(() => computeOverviewKpis(realTrades), [realTrades]);
  const equityData = useMemo(() => computeEquityCurve(realTrades), [realTrades]);

  function openCreate() {
    setEditingTrade(undefined);
    setFormOpen(true);
  }

  function openEdit(trade: Trade) {
    setEditingTrade(trade);
    setFormOpen(true);
  }

  async function handleSubmit(input: Parameters<typeof createTrade>[0]) {
    if (editingTrade) {
      await updateTrade(editingTrade.id, input);
    } else {
      await createTrade(input);
    }
  }

  async function handleDelete(trade: Trade) {
    if (confirm(`Trade ${trade.pair} op ${trade.datum_open} verwijderen?`)) {
      setDeleteError(null);
      try {
        await deleteTrade(trade.id);
      } catch (err) {
        setDeleteError(toErrorMessage(err, "Verwijderen van trade is mislukt"));
      }
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle ?? `${realTrades.length} trades`}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
          >
            <Plus size={15} /> Nieuwe trade
          </button>
        }
      />

      {(error || deleteError) && (
        <Card className="mb-5 border-loss/40">
          <p className="text-sm text-loss">{error ?? deleteError}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">Laden...</p>
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
                  {showMissed ? "Verberg missed trades" : `Toon missed trades (${missedCount})`}
                </button>
              )}
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-body transition-colors ${
                    viewMode === "calendar" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                  }`}
                >
                  <CalendarDays size={14} /> Kalender
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-body transition-colors ${
                    viewMode === "list" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                  }`}
                >
                  <ListIcon size={14} /> Lijst
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Totaal trades" value={kpis.totalTrades} />
            <StatCard
              label="Resultaat"
              value={`${kpis.totalResultaat > 0 ? "+" : ""}${kpis.totalResultaat}%`}
              tone={kpis.totalResultaat >= 0 ? "up" : "down"}
            />
            <StatCard label="Max drawdown" value={`${kpis.maxDrawdownPct > 0 ? "-" : ""}${kpis.maxDrawdownPct}%`} tone="down" />
            <Card className="flex items-center gap-3">
              <Flame size={16} className="text-loss" />
              <div>
                <p className="font-body text-xs uppercase tracking-wider text-muted">Streaks</p>
                <p className="font-mono text-sm mt-1 text-ink">
                  max verlies <span className="text-loss">{kpis.maxLosingStreak}</span> · max winst{" "}
                  <span className="text-win">{kpis.maxWinningStreak}</span>
                </p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="flex flex-col items-center justify-center">
              <h3 className="font-display text-xl italic mb-2 self-start text-ink">Win rate</h3>
              <WinRatePieChart wins={kpis.wins} be={kpis.be} losses={kpis.losses} />
              <div className="flex gap-4 mt-3 font-mono text-xs">
                <span className="text-win">{kpis.wins}W</span>
                <span className="text-be">{kpis.be}BE</span>
                <span className="text-loss">{kpis.losses}L</span>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <h3 className="font-display text-xl italic mb-4 text-ink">Cumulatief resultaat</h3>
              <EquityCurveChart data={equityData} />
            </Card>
          </div>

          {viewMode === "calendar" ? (
            <CalendarView trades={realTrades} missedTrades={isLive && showMissed ? missedTrades : undefined} />
          ) : (
            <TradeList
              trades={listTrades}
              onEdit={openEdit}
              onDelete={handleDelete}
              title="Trades"
              filtersActive={filtersActive}
              onResetFilters={resetFilters}
            />
          )}
        </div>
      )}

      {formOpen && (
        <TradeForm trade={editingTrade} onSubmit={handleSubmit} onClose={() => setFormOpen(false)} allowMissedTrade={isLive} />
      )}
    </>
  );
}
