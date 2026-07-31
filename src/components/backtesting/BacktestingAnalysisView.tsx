import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { FaseBarChart } from "@/components/charts/FaseBarChart";
import { BreakdownTable } from "@/components/breakdown/BreakdownTable";
import { BreakdownGrid } from "@/components/breakdown/BreakdownGrid";
import {
  computeOverviewKpis, breakdownBy, breakdownByWithFaseSplit, breakdownByFaseKenmerk,
  computeTpfsStats, computeDurationByOutcome, groupIntoSeries,
} from "@/lib/stats";
import { BREAKDOWN_DIMENSIONS } from "@/lib/breakdownDimensions";
import { FASE_KENMERKEN, FASES, OUTCOMES } from "@/lib/constants";
import type { Trade } from "@/lib/types";

/**
 * Overview KPIs, per-Fase cards, TPFS block, duration, series-of-5, and every
 * "Per X" breakdown — all derived from whatever `trades` slice is passed in.
 * Used for the live-trade combined view is NOT this component (that's
 * TradeJournalView); this is purely the deep-analysis half, reused per
 * backtest project so each project's numbers never mix with another's.
 */
export function BacktestingAnalysisView({ trades }: { trades: Trade[] }) {
  const [viewMode, setViewMode] = useState<"totaal" | "per-fase">("totaal");

  const kpis = useMemo(() => computeOverviewKpis(trades), [trades]);
  const byFase = useMemo(() => breakdownBy(trades, (t) => t.fase, { minSample: 1, sortOrder: FASES }), [trades]);
  const tpfs = useMemo(() => computeTpfsStats(trades), [trades]);
  const duration = useMemo(() => computeDurationByOutcome(trades), [trades]);
  const series = useMemo(() => groupIntoSeries(trades, 5), [trades]);

  const dimensionRows = useMemo(
    () => BREAKDOWN_DIMENSIONS.map((d) => ({ dim: d, rows: breakdownBy(trades, d.keyFn, { sortOrder: d.sortOrder }) })),
    [trades]
  );
  const dimensionGridRows = useMemo(
    () => BREAKDOWN_DIMENSIONS.map((d) => ({ dim: d, rows: breakdownByWithFaseSplit(trades, d.keyFn, { sortOrder: d.sortOrder }) })),
    [trades]
  );

  const kenmerkRows = useMemo(
    () =>
      FASE_KENMERKEN.filter((k) => !k.computed).map((k) => ({
        config: k,
        rows: breakdownByFaseKenmerk(trades, k, { minSample: 1 }),
      })),
    [trades]
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Overview KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Totaal trades" value={kpis.totalTrades} />
        <StatCard
          label="Resultaat"
          value={`${kpis.totalResultaat > 0 ? "+" : ""}${kpis.totalResultaat}%`}
          tone={kpis.totalResultaat >= 0 ? "up" : "down"}
        />
        <StatCard label="Win / BE / Loss rate" value={`${(kpis.winRate * 100).toFixed(0)}/${(kpis.beRate * 100).toFixed(0)}/${(kpis.lossRate * 100).toFixed(0)}%`} />
        <StatCard label="Max drawdown" value={`-${kpis.maxDrawdownPct}%`} tone="down" />
        <StatCard label="Max losing streak" value={kpis.maxLosingStreak} tone="down" />
        <StatCard label="Max winning streak" value={kpis.maxWinningStreak} tone="up" />
        <StatCard label="Huidige streak" value={`${kpis.currentStreak.count} ${kpis.currentStreak.type}`} />
        <StatCard
          label="Win/Loss ratio"
          value={kpis.winLossRatio != null ? kpis.winLossRatio.toFixed(2) : "—"}
          sub={kpis.avgWin != null && kpis.avgLoss != null ? `avg win ${kpis.avgWin}% / avg loss ${kpis.avgLoss}%` : undefined}
        />
      </section>

      {/* Per Fase KPI cards + bar chart */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {byFase.map((f) => (
            <Card key={f.key}>
              <p className="font-display text-2xl italic text-gold">{f.label}</p>
              <p className="font-mono text-2xl mt-2 text-ink">
                {f.n} <span className="text-xs text-muted">trades</span>
              </p>
              <p className={`font-mono text-sm mt-1 ${f.resultaatTotal >= 0 ? "text-win" : "text-loss"}`}>
                {f.resultaatTotal > 0 ? "+" : ""}
                {f.resultaatTotal}%
              </p>
              <p className="font-body text-xs mt-1 text-muted">{(f.winRate * 100).toFixed(0)}% win rate</p>
            </Card>
          ))}
        </div>
        <Card>
          <h3 className="font-display text-xl italic mb-4 text-ink">Resultaat per Fase</h3>
          <FaseBarChart data={byFase} />
        </Card>
      </section>

      {/* TPFS */}
      <section>
        <h2 className="font-display text-xl italic mb-3 text-ink">TPFS (TP on First Structure)</h2>
        <p className="font-body text-xs text-muted mb-3">
          Hypothetisch, parallel resultaat — telt nooit mee in de statistieken hierboven.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Trades met TPFS" value={tpfs.n} />
          <StatCard label="TPFS resultaat" value={`${tpfs.totalTpfs > 0 ? "+" : ""}${tpfs.totalTpfs}%`} tone={tpfs.totalTpfs >= 0 ? "up" : "down"} />
          <StatCard label="TPFS win rate" value={`${(tpfs.winRate * 100).toFixed(0)}%`} />
          <StatCard label="TPFS gemiddeld" value={`${tpfs.avgTpfs}%`} />
        </div>
      </section>

      {/* Duration by outcome */}
      <section>
        <h2 className="font-display text-xl italic mb-3 text-ink">Gemiddelde duur per outcome</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {OUTCOMES.map((o) => (
            <StatCard key={o} label={o} value={duration[o].avgDays != null ? `${duration[o].avgDays}d` : "—"} sub={`n=${duration[o].n}`} />
          ))}
        </div>
      </section>

      {/* Series of 5 */}
      <section>
        <h2 className="font-display text-xl italic mb-3 text-ink">Series van 5 opeenvolgende trades</h2>
        <Card>
          <div className="flex flex-wrap gap-2">
            {series.map((s) => (
              <div
                key={s.seriesIndex}
                className="rounded-lg px-3 py-2 border border-border font-mono text-xs flex flex-col items-center gap-1"
                style={{ background: s.resultaatTotal >= 0 ? "rgba(95,174,130,0.08)" : "rgba(224,102,90,0.08)" }}
              >
                <span className="text-muted">#{s.seriesIndex}</span>
                <span className={s.resultaatTotal >= 0 ? "text-win" : "text-loss"}>
                  {s.resultaatTotal > 0 ? "+" : ""}
                  {s.resultaatTotal}%
                </span>
                <span className="text-muted">{s.winCount}/{s.trades.length}W</span>
              </div>
            ))}
            {series.length === 0 && <p className="text-sm text-muted">Nog geen trades.</p>}
          </div>
        </Card>
      </section>

      {/* Uitsplitsingen */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl italic text-ink">Uitsplitsingen</h2>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("totaal")}
              className={`px-3 py-1.5 text-xs font-body ${viewMode === "totaal" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
            >
              Totaal
            </button>
            <button
              onClick={() => setViewMode("per-fase")}
              className={`px-3 py-1.5 text-xs font-body ${viewMode === "per-fase" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
            >
              Per Fase
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {viewMode === "totaal"
            ? dimensionRows.map(({ dim, rows }) => <BreakdownTable key={dim.id} title={dim.label} rows={rows} />)
            : dimensionGridRows.map(({ dim, rows }) => <BreakdownGrid key={dim.id} title={dim.label} rows={rows} />)}
        </div>
      </section>

      {/* Fase-kenmerken */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl italic text-ink">Fase-kenmerken</h2>
        {FASES.map((fase) => {
          const configs = kenmerkRows.filter((k) => k.config.fase === fase);
          if (configs.length === 0) return null;
          return (
            <div key={fase} className="flex flex-col gap-3">
              <h3 className="font-body text-sm text-muted">{fase}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {configs.map(({ config, rows }) => (
                  <BreakdownTable key={config.field} title={config.label} rows={rows} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
