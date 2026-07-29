import { useMemo, useState } from "react";
import { Plus, Flame, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { WinRatePieChart } from "@/components/charts/WinRatePieChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { CalendarView } from "@/components/calendar/CalendarView";
import { TradeList } from "@/components/trades/TradeList";
import { TradeForm } from "@/components/trades/TradeForm";
import { type TradeScope, type TradesApi } from "@/hooks/useTrades";
import { computeOverviewKpis, computeEquityCurve } from "@/lib/stats";
import type { Trade } from "@/lib/types";

interface TradeJournalViewProps {
  scope: TradeScope;
  /** Owned by the page, not this component — see TradesApi on why it must be a single shared instance. */
  tradesApi: TradesApi;
  title: string;
  subtitle?: string;
  /** Recent-trades list is capped like the live Journal; project dashboards show the full list. */
  recentOnly?: boolean;
}

/**
 * Calendar + KPI row + equity curve + win-rate gauge + trade list, fully scoped
 * to either the live Journal or a single backtest project — trades never leak
 * across scopes (enforced by useTrades' scope filter, not just UI hiding).
 *
 * Missed trades (trade_evaluation = "Missed trade", live scope only — a
 * backtest project never offers that option) carry a hypothetical outcome, so
 * they're excluded from KPIs/equity curve/calendar unconditionally — those
 * represent real performance and must never be diluted by a "what if". The
 * "toon missed trades" toggle only affects the trade list, where each one is
 * clearly badged, never the numbers.
 */
export function TradeJournalView({ scope, tradesApi, title, subtitle, recentOnly = false }: TradeJournalViewProps) {
  const { trades, loading, error, createTrade, updateTrade, deleteTrade } = tradesApi;
  const [formOpen, setFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>(undefined);
  const [showMissed, setShowMissed] = useState(false);

  const isLive = scope.type === "live";
  const realTrades = useMemo(() => trades.filter((t) => t.trade_evaluation !== "Missed trade"), [trades]);
  const missedTrades = useMemo(() => trades.filter((t) => t.trade_evaluation === "Missed trade"), [trades]);
  const missedCount = missedTrades.length;
  const listTrades = isLive && showMissed ? trades : realTrades;

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
      await deleteTrade(trade.id);
    }
  }

  const missedToggle = isLive && (
    <button
      onClick={() => setShowMissed((v) => !v)}
      disabled={missedCount === 0}
      className="flex items-center gap-1.5 text-xs font-body text-muted hover:text-ink transition-colors disabled:opacity-40 disabled:hover:text-muted disabled:cursor-default"
    >
      {showMissed ? <EyeOff size={13} /> : <Eye size={13} />}
      {showMissed ? "Verberg missed trades" : `Toon missed trades (${missedCount})`}
    </button>
  );

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle ?? `${realTrades.length} trades`}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-bg"
          >
            <Plus size={15} /> Nieuwe trade
          </button>
        }
      />

      {error && (
        <Card className="mb-5 border-loss/40">
          <p className="text-sm text-loss">{error}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">Laden...</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Totaal trades" value={kpis.totalTrades} />
            <StatCard
              label="Resultaat"
              value={`${kpis.totalResultaat > 0 ? "+" : ""}${kpis.totalResultaat}%`}
              tone={kpis.totalResultaat >= 0 ? "up" : "down"}
            />
            <StatCard label="Max drawdown" value={`-${kpis.maxDrawdownPct}%`} tone="down" />
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

          <CalendarView
            trades={realTrades}
            missedTrades={isLive && showMissed ? missedTrades : undefined}
            headerAction={missedToggle}
          />

          <TradeList
            trades={listTrades}
            onEdit={openEdit}
            onDelete={handleDelete}
            title={recentOnly ? "Recente trades" : "Trades"}
            limit={recentOnly ? 8 : undefined}
            headerAction={missedToggle}
          />
        </div>
      )}

      {formOpen && (
        <TradeForm trade={editingTrade} onSubmit={handleSubmit} onClose={() => setFormOpen(false)} allowMissedTrade={isLive} />
      )}
    </>
  );
}
