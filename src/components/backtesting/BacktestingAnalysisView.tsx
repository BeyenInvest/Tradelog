import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { FaseBarChart } from "@/components/charts/FaseBarChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { BreakdownTable } from "@/components/breakdown/BreakdownTable";
import { BreakdownGrid } from "@/components/breakdown/BreakdownGrid";
import { PeriodPicker } from "@/components/trades/PeriodPicker";
import { FilterPanel } from "@/components/trades/FilterPanel";
import {
  computeOverviewKpis, breakdownBy, breakdownByWithFaseSplit, breakdownByFaseKenmerk,
  computeDurationByOutcome, computeEquityCurve, groupIntoSeries, takenTrades,
} from "@/lib/stats";
import { BREAKDOWN_DIMENSIONS } from "@/lib/breakdownDimensions";
import { FASE_KENMERKEN, FASES, OUTCOMES } from "@/lib/constants";
import { applyJournalFilters, EMPTY_FILTERS, type JournalFilters } from "@/lib/tradeFilters";
import type { DateRange } from "@/lib/periodRanges";
import type { Trade } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

/**
 * Overview KPIs, per-Fase cards, duration, series-of-5, and every
 * "Per X" breakdown — all derived from whatever `trades` slice is passed in,
 * scoped further by the period/filter toolbar this component owns itself
 * (same applyJournalFilters gate as TradeJournalView, kept local here since
 * both the live-Journal Analyse tab and every project's Analyse tab render
 * this component independently). Used for the live-trade combined view is
 * NOT this component (that's TradeJournalView); this is purely the
 * deep-analysis half, reused per backtest project so each project's numbers
 * never mix with another's.
 */
export function BacktestingAnalysisView({
  trades, hideFaseOverride,
}: {
  trades: Trade[];
  /** Admin read-only view passes the viewed profile's own hide_fase here instead of the viewer's — see AdminUserDetailPage. */
  hideFaseOverride?: boolean;
}) {
  const { t } = useTranslation();
  const { hideFase: ownHideFase } = useAuth();
  const hideFase = hideFaseOverride ?? ownHideFase;
  const [viewMode, setViewMode] = useState<"totaal" | "per-fase">("totaal");
  const [period, setPeriod] = useState<DateRange | null>(null);
  const [filters, setFilters] = useState<JournalFilters>(EMPTY_FILTERS);

  // Backtest projects don't offer "Missed trade" as an evaluation in the UI, but there's no DB
  // constraint enforcing that — filter defensively so a stray one can never dilute these KPIs.
  const scopedTrades = useMemo(
    () => takenTrades(applyJournalFilters(trades, period, filters)),
    [trades, period, filters]
  );

  const kpis = useMemo(() => computeOverviewKpis(scopedTrades), [scopedTrades]);
  const byFase = useMemo(() => breakdownBy(scopedTrades, (t) => t.fase, { sortOrder: FASES }), [scopedTrades]);
  const equityData = useMemo(() => computeEquityCurve(scopedTrades), [scopedTrades]);
  const duration = useMemo(() => computeDurationByOutcome(scopedTrades), [scopedTrades]);
  const series = useMemo(() => groupIntoSeries(scopedTrades, 5), [scopedTrades]);

  const dimensionRows = useMemo(
    () => BREAKDOWN_DIMENSIONS.map((d) => ({ dim: d, rows: breakdownBy(scopedTrades, d.keyFn, { sortOrder: d.sortOrder }) })),
    [scopedTrades]
  );
  const dimensionGridRows = useMemo(
    () =>
      BREAKDOWN_DIMENSIONS.map((d) => ({ dim: d, rows: breakdownByWithFaseSplit(scopedTrades, d.keyFn, { sortOrder: d.sortOrder }) })),
    [scopedTrades]
  );
  // Fase-kenmerken sits between Weekly Kenmerk and CC — the weekly dimensions read as more important,
  // the phase-specific setup checklists as the next most important, then the lower-signal dimensions after.
  // Falls back to splitting after the first dimension if "weekly_kenmerk" is ever renamed/removed, rather
  // than silently collapsing this whole section to 0 rows (findIndex returning -1 would do that).
  const weeklyKenmerkIdx = BREAKDOWN_DIMENSIONS.findIndex((d) => d.id === "weekly_kenmerk");
  const kenmerkenSplit = weeklyKenmerkIdx === -1 ? 1 : weeklyKenmerkIdx + 1;

  const kenmerkRows = useMemo(
    () =>
      FASE_KENMERKEN.filter((k) => !k.computed).map((k) => ({
        config: k,
        rows: breakdownByFaseKenmerk(scopedTrades, k, { minSample: 1 }),
      })),
    [scopedTrades]
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Period + filter toolbar — scopes every KPI, chart and breakdown below */}
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker value={period} onChange={setPeriod} />
        <FilterPanel value={filters} onChange={setFilters} />
      </div>

      {/* Overview KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t("backtestingAnalysis.totalTrades")} value={kpis.totalTrades} />
        <StatCard
          label={t("backtestingAnalysis.result")}
          value={`${kpis.totalResultaat > 0 ? "+" : ""}${kpis.totalResultaat}%`}
          tone={kpis.totalResultaat >= 0 ? "up" : "down"}
        />
        <StatCard label={t("backtestingAnalysis.winBeLossRate")} value={`${(kpis.winRate * 100).toFixed(0)}/${(kpis.beRate * 100).toFixed(0)}/${(kpis.lossRate * 100).toFixed(0)}%`} />
        <StatCard label={t("backtestingAnalysis.maxDrawdown")} value={`${kpis.maxDrawdownPct > 0 ? "-" : ""}${kpis.maxDrawdownPct}%`} tone="down" />
        <StatCard label={t("backtestingAnalysis.maxLosingStreak")} value={kpis.maxLosingStreak} tone="down" />
        <StatCard label={t("backtestingAnalysis.maxWinningStreak")} value={kpis.maxWinningStreak} tone="up" />
        <StatCard label={t("backtestingAnalysis.currentStreak")} value={`${kpis.currentStreak.count} ${kpis.currentStreak.type}`} />
        <StatCard
          label={t("backtestingAnalysis.winLossRatio")}
          value={kpis.winLossRatio != null ? kpis.winLossRatio.toFixed(2) : "—"}
          sub={kpis.avgWin != null && kpis.avgLoss != null ? t("backtestingAnalysis.avgWinLoss", { win: kpis.avgWin, loss: kpis.avgLoss }) : undefined}
        />
      </section>

      {/* Per Fase KPI cards + bar chart */}
      <section className="flex flex-col gap-4">
        {!hideFase && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {byFase.map((f) => (
              <Card key={f.key}>
                <p className="font-display text-2xl italic text-gold">{f.label}</p>
                <p className="font-mono text-2xl mt-2 text-ink flex items-center gap-2">
                  {f.n} <span className="text-xs text-muted font-body">{t("backtestingAnalysis.trades")}</span>
                </p>
                <p className={`font-mono text-sm mt-1 ${f.resultaatTotal >= 0 ? "text-win" : "text-loss"}`}>
                  {f.resultaatTotal > 0 ? "+" : ""}
                  {f.resultaatTotal}%
                </p>
                <p className="font-body text-xs mt-1 text-muted">
                  <span className="text-win">{(f.winRate * 100).toFixed(0)}% win</span>
                  {" · "}
                  <span className="text-loss">{(f.lossRate * 100).toFixed(0)}% loss</span>
                </p>
                <p className="font-mono text-[11px] mt-1 text-muted">
                  <span className="text-win">{f.wins}W</span>
                  {" / "}
                  <span className="text-be">{f.be}BE</span>
                  {" / "}
                  <span className="text-loss">{f.losses}L</span>
                </p>
              </Card>
            ))}
          </div>
        )}
        <div className={`grid grid-cols-1 gap-5 ${hideFase ? "" : "lg:grid-cols-2"}`}>
          <Card>
            <h3 className="font-display text-xl italic mb-4 text-ink">{t("backtestingAnalysis.cumulativeResult")}</h3>
            <EquityCurveChart data={equityData} />
          </Card>
          {!hideFase && (
            <Card>
              <h3 className="font-display text-xl italic mb-4 text-ink">{t("backtestingAnalysis.resultPerFase")}</h3>
              <FaseBarChart data={byFase} />
            </Card>
          )}
        </div>
      </section>

      {/* Series of 5 */}
      <section>
        <h2 className="font-display text-xl italic mb-3 text-ink">{t("backtestingAnalysis.seriesHeading")}</h2>
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
            {series.length === 0 && <p className="text-sm text-muted">{t("backtestingAnalysis.noTrades")}</p>}
          </div>
        </Card>
      </section>

      {/* Uitsplitsingen */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl italic text-ink">{t("backtestingAnalysis.breakdownsHeading")}</h2>
          {!hideFase && (
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("totaal")}
                className={`px-3 py-1.5 text-xs font-body ${viewMode === "totaal" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
              >
                {t("backtestingAnalysis.total")}
              </button>
              <button
                onClick={() => setViewMode("per-fase")}
                className={`px-3 py-1.5 text-xs font-body ${viewMode === "per-fase" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
              >
                {t("backtestingAnalysis.perFase")}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-display text-lg italic text-ink">{t("backtestingAnalysis.setupWeeklyHeading")}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {viewMode === "totaal"
              ? dimensionRows.slice(0, kenmerkenSplit).map(({ dim, rows }) => <BreakdownTable key={dim.id} title={t(`breakdown.${dim.id}`)} rows={rows} />)
              : dimensionGridRows.slice(0, kenmerkenSplit).map(({ dim, rows }) => <BreakdownGrid key={dim.id} title={t(`breakdown.${dim.id}`)} rows={rows} />)}
          </div>
        </div>

        {/* Fase-kenmerken */}
        {!hideFase && (
          <div className="flex flex-col gap-4">
            <h3 className="font-display text-lg italic text-ink">{t("backtestingAnalysis.faseKenmerkenHeading")}</h3>
            {FASES.map((fase) => {
              const configs = kenmerkRows.filter((k) => k.config.fase === fase);
              if (configs.length === 0) return null;
              return (
                <div key={fase} className="flex flex-col gap-3">
                  <h4 className="font-body text-sm text-muted">{fase}</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {configs.map(({ config, rows }) => (
                      <BreakdownTable key={config.field} title={t(`faseKenmerken.${config.field}`)} rows={rows} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="font-display text-lg italic text-ink">{t("backtestingAnalysis.timingInstrumentHeading")}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {viewMode === "totaal"
              ? dimensionRows.slice(kenmerkenSplit).map(({ dim, rows }) => <BreakdownTable key={dim.id} title={t(`breakdown.${dim.id}`)} rows={rows} />)
              : dimensionGridRows.slice(kenmerkenSplit).map(({ dim, rows }) => <BreakdownGrid key={dim.id} title={t(`breakdown.${dim.id}`)} rows={rows} />)}
          </div>
        </div>
      </section>

      {/* Duration per outcome — supplementary numbers, so compact and last, not competing with the real KPIs at top */}
      <section className="flex flex-col gap-3">
        <h3 className="font-body text-sm uppercase tracking-wider text-muted">{t("backtestingAnalysis.durationHeading")}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {OUTCOMES.map((o) => (
            <StatCard
              key={o}
              compact
              label={t("backtestingAnalysis.durationFor", { outcome: o })}
              value={duration[o].avgDays != null ? `${duration[o].avgDays}d` : "—"}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
