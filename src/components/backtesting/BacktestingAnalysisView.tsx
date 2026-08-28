import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { FaseBarChart } from "@/components/charts/FaseBarChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { RDistributionChart } from "@/components/charts/RDistributionChart";
import { BreakdownTable } from "@/components/breakdown/BreakdownTable";
import { BreakdownGrid } from "@/components/breakdown/BreakdownGrid";
import { CrossTable, type CrossDim } from "@/components/breakdown/CrossTable";
import { SectionShell } from "@/components/analyse/SectionShell";
import { AdherenceSection, type AdherenceDimension } from "@/components/backtesting/AdherenceSection";
import { ExitAnalysisSection } from "@/components/backtesting/ExitAnalysisSection";
import { PeriodPicker } from "@/components/trades/PeriodPicker";
import { FilterPanel } from "@/components/trades/FilterPanel";
import {
  computeOverviewKpis, breakdownBy, breakdownByWithFaseSplit, breakdownByFaseKenmerk,
  computeDurationByOutcome, groupIntoSeries, takenTrades, closedTrades,
  computeRHistogram, computeRDistribution, computeEvaluationImpact, computeConditionGaps,
} from "@/lib/stats";
import { useAnalyseLayout } from "@/hooks/useAnalyseLayout";
import { breakdownDimensionsFor, customFieldDimensions, type DimensionConfig } from "@/lib/breakdownDimensions";
import { FASE_KENMERKEN, FASES, OUTCOMES } from "@/lib/constants";
import { applyJournalFilters, EMPTY_FILTERS, type JournalFilters } from "@/lib/tradeFilters";
import { formatAggregate, formatProfitFactor, formatResult, pctToAmount, resultDisplayValue, tradesInResultUnit } from "@/lib/format";
import { useResultDisplay } from "@/hooks/useResultDisplay";
import type { DateRange } from "@/lib/periodRanges";
import type { MethodologyView, Trade } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";

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

/** Sections open on a first visit — everything else starts collapsed (audit T2). Module-scoped for a stable reference across renders (used in the layout hook's deps). */
const DEFAULT_OPEN_SECTIONS = ["kpis", "performance"];

export function BacktestingAnalysisView({
  trades, hideFaseOverride, methodologyOverride, showAdherence = false,
}: {
  trades: Trade[];
  /** Admin read-only view passes the viewed profile's own hide_fase here instead of the viewer's — see AdminUserDetailPage. */
  hideFaseOverride?: boolean;
  /**
   * Admin read-only view passes the *viewed* user's journal (fields + is-legacy/
   * is-forex) here instead of the viewer's own useMethodology() — otherwise the
   * breakdowns would follow the admin's active journal, not the user's (H2).
   */
  methodologyOverride?: MethodologyView;
  /**
   * Regel-adherentie (Fase N2) is live-journal-only: trade_evaluation isn't
   * selectable in a backtest project, and there the condition gaps would just
   * summarize the breakdown tables below (owner feedback). Live-journal call
   * sites (JournalPage, AdminUserDetailPage) opt in; project views don't.
   */
  showAdherence?: boolean;
}) {
  const { t } = useTranslation();
  const { hideFase: ownHideFase, profile } = useAuth();
  const ownMethodology = useMethodology();
  // Admin read-only view supplies the viewed user's journal; every other call site
  // uses the signed-in user's own active methodology.
  const { fields, isLegacyMethodology, isForexJournal, trackExit } = methodologyOverride ?? ownMethodology;
  const hideFase = hideFaseOverride ?? ownHideFase;
  // A non-Weekly-Phase-Method journal never fills the legacy fase/weekly/cc columns, so its
  // per-fase cards + fase-kenmerken + WPM-only breakdowns would be all-empty. Gate that whole
  // block on the active journal actually being the legacy one (cyclus 4); such a journal sees
  // only the universal KPIs/curve + universal dimensions + its own custom-field breakdowns.
  const showFase = isLegacyMethodology && !hideFase;
  const [viewMode, setViewMode] = useState<"totaal" | "per-fase">("totaal");
  const [period, setPeriod] = useState<DateRange | null>(null);
  const [filters, setFilters] = useState<JournalFilters>(EMPTY_FILTERS);

  // Backtest projects don't offer "Missed trade" (or a still-running "open") trade
  // in the UI, but there's no DB constraint enforcing that — filter defensively via
  // takenTrades + closedTrades so a stray one can never dilute these KPIs.
  const scopedTrades = useMemo(
    () => closedTrades(takenTrades(applyJournalFilters(trades, period, filters))),
    [trades, period, filters]
  );

  const kpis = useMemo(() => computeOverviewKpis(scopedTrades), [scopedTrades]);
  // R-distributie (Fase S2): fixed 1R-bin histogram + spread/quality (stdDev, SQN),
  // both on the real %-trades — R is inherently R-unit, so the %/R/$ toggle doesn't apply.
  const rHistogram = useMemo(() => computeRHistogram(scopedTrades), [scopedTrades]);
  const rDist = useMemo(() => computeRDistribution(scopedTrades), [scopedTrades]);
  // Weergavelaag-conversie (Fase J): alle som-gebaseerde uitsplitsingen hieronder
  // rekenen op deze lijst, waarin resultaat_pct in R-modus de R-ratio is. De KPI's
  // hierboven blijven op de echte %-trades (Resultaat converteert via kpis.totalR;
  // ratio's en drawdown blijven bewust %-gebaseerd).
  const { unit: resultUnit, saldo } = useResultDisplay();
  const displayTrades = useMemo(() => tradesInResultUnit(scopedTrades, resultUnit, saldo), [scopedTrades, resultUnit, saldo]);
  const byFase = useMemo(() => breakdownBy(displayTrades, (t) => t.fase, { sortOrder: FASES }), [displayTrades]);
  const duration = useMemo(() => computeDurationByOutcome(scopedTrades), [scopedTrades]);
  const series = useMemo(() => groupIntoSeries(displayTrades, 5), [displayTrades]);

  // Journal-type-aware dimension list (0051): identical to the static list for the
  // legacy WPM journal; other journals get the time-based "Per Sessie" swapped in.
  const dimensions = breakdownDimensionsFor(isLegacyMethodology);
  // Per-dimension row-label translator: the breakdown key stays a stable id, the
  // label follows the UI language (weekday abbreviations, Yes/No). Omitted → key shown as-is.
  const labelFnFor = (d: DimensionConfig) =>
    d.labelFn ? (k: string) => d.labelFn!(k, t) : undefined;
  const dimensionRows = useMemo(
    () => dimensions.map((d) => ({ dim: d, rows: breakdownBy(displayTrades, d.keyFn, { sortOrder: d.sortOrder, labelFn: labelFnFor(d) }) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayTrades, isLegacyMethodology, t]
  );
  const dimensionGridRows = useMemo(
    () =>
      dimensions.map((d) => ({ dim: d, rows: breakdownByWithFaseSplit(displayTrades, d.keyFn, { sortOrder: d.sortOrder, labelFn: labelFnFor(d) }) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayTrades, isLegacyMethodology, t]
  );
  // Fase-kenmerken sits between Weekly Kenmerk and CC — the weekly dimensions read as more important,
  // the phase-specific setup checklists as the next most important, then the lower-signal dimensions after.
  // Falls back to splitting after the first dimension if "weekly_kenmerk" is ever renamed/removed, rather
  // than silently collapsing this whole section to 0 rows (findIndex returning -1 would do that).
  const weeklyKenmerkIdx = dimensions.findIndex((d) => d.id === "weekly_kenmerk");
  const kenmerkenSplit = weeklyKenmerkIdx === -1 ? 1 : weeklyKenmerkIdx + 1;

  // The per-fase split is Weekly-Phase-Method-specific; force "totaal" when the fase block is
  // hidden so a stale toggle state can't leave the breakdowns rendering an empty per-fase grid.
  const effectiveViewMode = showFase ? viewMode : "totaal";
  // The first group (setup/weekly) is entirely legacy WPM columns; the second (timing/instrument)
  // mixes universal dims (weekday/quarter/instrument/direction), forex-only dims (pair/currency,
  // cyclus 7) and legacy WPM dims (cc/sessie/nieuws). Show each per the active journal's type.
  const showTimingDim = (dim: { universal?: boolean; forex?: boolean }) =>
    dim.universal || (dim.forex && isForexJournal) || (!dim.universal && !dim.forex && isLegacyMethodology);
  // Also skip dimensions with no data at all (rows.length 0) — e.g. "Per Richting"
  // before any trade carries a direction: an empty card is noise, and it appears by
  // itself as soon as the data exists.
  const timingDimRows = dimensionRows
    .slice(kenmerkenSplit)
    .filter(({ dim, rows }) => showTimingDim(dim) && rows.length > 0);
  const timingDimGridRows = dimensionGridRows.slice(kenmerkenSplit).filter(({ rows }) => rows.length > 0);

  // On a forex journal instrument mirrors pair, so the instrument split IS the pair
  // split — title it "Per Pair" there (the term forex traders think in); other
  // journals see the universal "Per Instrument".
  const timingDimTitle = (dimId: string) =>
    dimId === "instrument" && isForexJournal ? t("breakdown.pair") : t(`breakdown.${dimId}`);

  const kenmerkRows = useMemo(
    () =>
      FASE_KENMERKEN.filter((k) => !k.computed).map((k) => ({
        config: k,
        rows: breakdownByFaseKenmerk(displayTrades, k, { minSample: 1 }),
      })),
    [displayTrades]
  );

  // Config-driven breakdowns for the active journal's own custom fields (cyclus 4),
  // read from the trades.custom bag. Empty for a plain Weekly Phase Method journal
  // (its fields are legacy columns, handled by the per-fase sections above), so this
  // adds nothing for the owner and everything for a preset/custom journal.
  const customDims = useMemo(() => customFieldDimensions(fields, scopedTrades, t), [fields, scopedTrades, t]);
  const customDimRows = useMemo(
    () =>
      customDims
        .map((d) => ({ dim: d, rows: breakdownBy(displayTrades, d.keyFn, { sortOrder: d.sortOrder, labelFn: d.labelFn ? (k: string) => d.labelFn!(k, t) : undefined }) }))
        // Skip custom-field dimensions with no data yet (rows.length 0) — same as
        // timingDimRows above. A fresh preset journal defines many fields before any
        // trade fills them, which otherwise rendered a wall of empty "No data." cards.
        .filter(({ rows }) => rows.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayTrades, customDims, t]
  );

  // Regel-adherentie (Fase N2, live voor iedereen — enkel data-/showAdherence-gated):
  // same journal-type-aware dimension set as the
  // breakdowns below (+ the journal's own custom fields), minus the calendar-derived
  // splits (weekday/quarter) — those aren't conditions to adhere to and their tables
  // already exist below. Titles/value-labels are pre-resolved so the section stays
  // i18n-free of dimension knowledge. Reads scopedTrades (real %), not
  // displayTrades — adherence is R-based internally.
  const adherenceDims = useMemo<AdherenceDimension[]>(
    () =>
      [
        ...(isLegacyMethodology ? dimensions.slice(0, kenmerkenSplit) : []),
        ...dimensions.slice(kenmerkenSplit).filter((d) => showTimingDim(d) && !d.dateDerived),
        ...customDims,
      ].map((d) => ({
        id: d.id,
        title: d.label ?? timingDimTitle(d.id),
        keyFn: d.keyFn,
        labelFn: d.labelFn ? (k: string) => d.labelFn!(k, t) : undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLegacyMethodology, isForexJournal, customDims, t]
  );

  // Kruistabel-dimensies (Fase S2, live voor iedereen — data-gated): exactly the dimensions whose plain
  // breakdowns render for this journal type — the legacy setup dims (WPM only), the
  // applicable timing/instrument dims, and the journal's own custom fields. Consumes
  // the same DimensionConfig list, pre-resolving each title + row-label translator so
  // CrossTable stays free of dimension/i18n knowledge (unlike adherence, this keeps
  // the calendar-derived splits — Setup × Uur is a genuine cross-tab).
  const crossDims = useMemo<CrossDim[]>(
    () =>
      [
        ...(isLegacyMethodology ? dimensions.slice(0, kenmerkenSplit) : []),
        ...dimensions.slice(kenmerkenSplit).filter(showTimingDim),
        ...customDims,
      ].map((d) => ({
        id: d.id,
        title: d.label ?? timingDimTitle(d.id),
        keyFn: d.keyFn,
        sortOrder: d.sortOrder,
        labelFn: d.labelFn ? (k: string) => d.labelFn!(k, t) : undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLegacyMethodology, isForexJournal, customDims, t]
  );

  // Visibility of the two self-hiding sections, computed here so the layout system
  // (which owns the section order) knows whether to render a titled shell at all —
  // mirrors each component's own null-guard exactly.
  const exitVisible = trackExit && scopedTrades.some((tr) => tr.mae_pct != null || tr.mfe_pct != null || tr.planned_rr != null);
  const adherenceVisible = useMemo(() => {
    if (!showAdherence) return false;
    if (computeEvaluationImpact(scopedTrades).graded > 0) return true;
    return computeConditionGaps(scopedTrades, adherenceDims).length > 0;
  }, [showAdherence, scopedTrades, adherenceDims]);

  // Per-user Analyse layout (Fase S2): collapse + drag-to-reorder of the sections
  // below, remembered in localStorage per account. Owner-besluit 2026-08-26: een
  // neutrale UX-verbetering, dus bewust voor ALLE gebruikers aan (niet achter beta).
  // De R-distributie/kruistabel-secties zijn sinds fb440da eveneens un-gated (enkel
  // data-gated via hun `visible`-vlag), niet meer beta-only.
  const interactive = true;
  // BINDEND (audit T2): a first visit opens only the overview + equity (result-verloop);
  // every other section — R-distribution, series-of-5, breakdowns, … — starts collapsed
  // so the page never grows unbounded as new sections are added. The user's own
  // collapse/expand choices take over the moment they touch the layout.
  const { orderedIds, move, toggleCollapse, isCollapsed, reset, isCustomized } = useAnalyseLayout(
    profile?.id ?? null,
    DEFAULT_OPEN_SECTIONS
  );

  // Every Analyse block as a reorderable/collapsible section (Fase S2). Order here
  // is the default; the layout hook permutes it per user. Conditional/data-gated
  // sections carry their own `visible` flag so they drop out cleanly (and the layout
  // never tries to order a section that isn't on screen).
  const sectionDefs: { id: string; title: string; action?: ReactNode; visible: boolean; body: ReactNode }[] = [
    {
      id: "kpis",
      title: t("analyseLayout.section_kpis"),
      visible: true,
      body: (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t("backtestingAnalysis.totalTrades")} value={kpis.totalTrades} />
          <StatCard
            label={t("backtestingAnalysis.result")}
            value={formatResult(kpis.totalResultaat, resultUnit, {
              rMultiple: kpis.totalR,
              rAssumed: kpis.rAssumedN > 0,
              amount: pctToAmount(kpis.totalResultaat, saldo),
            })}
            tone={resultDisplayValue(kpis.totalResultaat, resultUnit, { rMultiple: kpis.totalR }) >= 0 ? "up" : "down"}
          />
          <StatCard label={t("backtestingAnalysis.winBeLossRate")} value={`${(kpis.winRate * 100).toFixed(0)}/${(kpis.beRate * 100).toFixed(0)}/${(kpis.lossRate * 100).toFixed(0)}%`} />
          <StatCard
            label={t("backtestingAnalysis.avgR")}
            value={kpis.avgR != null ? `${kpis.avgR > 0 ? "+" : ""}${kpis.avgR.toFixed(2)}R` : "—"}
            tone={kpis.avgR != null ? (kpis.avgR >= 0 ? "up" : "down") : "neutral"}
            sub={
              kpis.avgR != null
                ? kpis.rAssumedN > 0
                  ? `${t("backtestingAnalysis.totalR", { total: kpis.totalR.toFixed(2) })} · ${t("journal.assumedRiskShort", { count: kpis.rAssumedN })}`
                  : t("backtestingAnalysis.totalR", { total: kpis.totalR.toFixed(2) })
                : undefined
            }
          />
          <StatCard label={t("backtestingAnalysis.maxDrawdown")} value={`${kpis.maxDrawdownPct > 0 ? "-" : ""}${kpis.maxDrawdownPct}%`} tone="down" />
          <StatCard label={t("backtestingAnalysis.maxLosingStreak")} value={kpis.maxLosingStreak} tone="down" />
          <StatCard label={t("backtestingAnalysis.maxWinningStreak")} value={kpis.maxWinningStreak} tone="up" />
          <StatCard
            label={t("backtestingAnalysis.currentStreak")}
            value={
              kpis.currentStreak.type === "none"
                ? "—"
                : `${kpis.currentStreak.count} ${t(`journal.streakType_${kpis.currentStreak.type}`)}`
            }
          />
          <StatCard
            label={t("backtestingAnalysis.winLossRatio")}
            value={kpis.winLossRatio != null ? kpis.winLossRatio.toFixed(2) : "—"}
            sub={kpis.avgWin != null && kpis.avgLoss != null ? t("backtestingAnalysis.avgWinLoss", { win: kpis.avgWin, loss: kpis.avgLoss }) : undefined}
          />
          <StatCard
            label={t("backtestingAnalysis.profitFactor")}
            value={formatProfitFactor(kpis.profitFactor)}
            tone={kpis.profitFactor == null ? "neutral" : kpis.profitFactor >= 1 ? "up" : "down"}
          />
        </div>
      ),
    },
    {
      id: "performance",
      title: t("analyseLayout.section_performance"),
      visible: true,
      body: (
        <>
          {showFase && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {byFase.map((f) => (
                <Card key={f.key}>
                  <p className="font-display text-2xl italic text-gold">{f.label}</p>
                  <p className="font-mono text-2xl mt-2 text-ink flex items-center gap-2">
                    {f.n} <span className="text-xs text-muted font-body">{t("backtestingAnalysis.trades")}</span>
                  </p>
                  <p className={`font-mono text-sm mt-1 ${f.resultaatTotal >= 0 ? "text-win" : "text-loss"}`}>
                    {formatAggregate(f.resultaatTotal, resultUnit)}
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
          <div className={`grid grid-cols-1 gap-5 ${showFase ? "lg:grid-cols-2" : ""}`}>
            <Card>
              <h3 className="font-display text-xl italic mb-4 text-ink">{t("backtestingAnalysis.cumulativeResult")}</h3>
              <EquityCurveChart trades={scopedTrades} />
            </Card>
            {showFase && (
              <Card>
                <h3 className="font-display text-xl italic mb-4 text-ink">{t("backtestingAnalysis.resultPerFase")}</h3>
                <FaseBarChart data={byFase} />
              </Card>
            )}
          </div>
        </>
      ),
    },
    {
      id: "rdist",
      title: t("rDistribution.heading"),
      // Live voor iedereen (owner 2026-08-26), enkel data-gated.
      visible: rHistogram.length > 0,
      body: (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 mb-3">
            <div className="min-w-0">
              <h3 className="font-display text-lg italic text-ink">{t("rDistribution.chartTitle")}</h3>
              <p className="font-body text-xs text-muted mt-0.5">{t("rDistribution.chartIntro")}</p>
            </div>
            <div className="flex gap-5 shrink-0">
              <div className="text-right" title={t("rDistribution.sqnHint")}>
                <p className="font-body text-[10px] uppercase tracking-wider text-muted">{t("rDistribution.sqn")}</p>
                <p
                  className={`font-mono text-xl leading-tight ${
                    rDist.sqn == null ? "text-ink" : rDist.sqn >= 2 ? "text-win" : rDist.sqn < 1 ? "text-loss" : "text-ink"
                  }`}
                >
                  {rDist.sqn != null ? rDist.sqn.toFixed(2) : "—"}
                </p>
              </div>
              <div className="text-right" title={t("rDistribution.stdDevHint")}>
                <p className="font-body text-[10px] uppercase tracking-wider text-muted">{t("rDistribution.stdDev")}</p>
                <p className="font-mono text-xl leading-tight text-ink">
                  {rDist.stdDevR != null ? `${rDist.stdDevR.toFixed(2)}R` : "—"}
                </p>
              </div>
            </div>
          </div>
          <RDistributionChart bins={rHistogram} />
        </Card>
      ),
    },
    {
      id: "series",
      title: t("backtestingAnalysis.seriesHeading"),
      visible: true,
      body: (
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
                  {formatAggregate(s.resultaatTotal, resultUnit)}
                </span>
                <span className="text-muted">{s.winCount}/{s.trades.length}W</span>
              </div>
            ))}
            {series.length === 0 && <p className="text-sm text-muted">{t("backtestingAnalysis.noTrades")}</p>}
          </div>
        </Card>
      ),
    },
    {
      id: "adherence",
      title: t("adherence.heading"),
      visible: adherenceVisible,
      body: <AdherenceSection trades={scopedTrades} dims={adherenceDims} hideHeading />,
    },
    {
      id: "exit",
      title: t("exitAnalysis.heading"),
      visible: exitVisible,
      body: <ExitAnalysisSection trades={scopedTrades} hideHeading />,
    },
    {
      // Kruistabel als aanloop naar de uitsplitsingen: net onder Overzicht/Series,
      // vlak vóór waar de analysekolommen beginnen (owner-verzoek). Live voor iedereen
      // (owner 2026-08-26), enkel data-gated: verschijnt zodra er ≥2 kruisbare dimensies zijn.
      id: "crosstable",
      title: t("crossTable.heading"),
      visible: crossDims.length >= 2,
      body: <CrossTable trades={displayTrades} dims={crossDims} />,
    },
    {
      id: "breakdowns",
      title: t("backtestingAnalysis.breakdownsHeading"),
      visible: true,
      action: showFase ? (
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
      ) : undefined,
      body: (
        <>
          {/* Setup & weekly — entirely legacy WPM columns, so only for the legacy journal. */}
          {isLegacyMethodology && (
            <div className="flex flex-col gap-3">
              <h3 className="font-display text-lg italic text-ink">{t("backtestingAnalysis.setupWeeklyHeading")}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {effectiveViewMode === "totaal"
                  ? dimensionRows.slice(0, kenmerkenSplit).map(({ dim, rows }) => <BreakdownTable key={dim.id} title={t(`breakdown.${dim.id}`)} rows={rows} />)
                  : dimensionGridRows.slice(0, kenmerkenSplit).map(({ dim, rows }) => <BreakdownGrid key={dim.id} title={t(`breakdown.${dim.id}`)} rows={rows} />)}
              </div>
            </div>
          )}

          {/* Fase-kenmerken */}
          {showFase && (
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
              {effectiveViewMode === "totaal"
                ? timingDimRows.map(({ dim, rows }) => <BreakdownTable key={dim.id} title={timingDimTitle(dim.id)} rows={rows} />)
                : timingDimGridRows.map(({ dim, rows }) => <BreakdownGrid key={dim.id} title={timingDimTitle(dim.id)} rows={rows} />)}
            </div>
          </div>

          {/* Config-driven: the active journal's own custom fields (cyclus 4). Only the
              "total" split — a per-fase split is inherently Weekly-Phase-Method-specific. */}
          {customDimRows.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="font-display text-lg italic text-ink">{t("backtestingAnalysis.customBreakdownHeading")}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {customDimRows.map(({ dim, rows }) => (
                  <BreakdownTable key={dim.id} title={dim.label ?? dim.id} rows={rows} />
                ))}
              </div>
            </div>
          )}
        </>
      ),
    },
    {
      id: "duration",
      title: t("backtestingAnalysis.durationHeading"),
      visible: true,
      body: (
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
      ),
    },
  ];

  const visibleSections = sectionDefs.filter((s) => s.visible);
  const visibleIds = visibleSections.map((s) => s.id);
  const orderedSections = orderedIds(visibleIds)
    .map((id) => visibleSections.find((s) => s.id === id))
    .filter((s): s is (typeof sectionDefs)[number] => s != null);

  return (
    <div className="flex flex-col gap-8">
      {/* Period + filter toolbar — scopes every KPI, chart and breakdown below */}
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker value={period} onChange={setPeriod} />
        <FilterPanel value={filters} onChange={setFilters} />
        {interactive && isCustomized && (
          <button
            onClick={reset}
            className="ml-auto font-body text-xs text-muted hover:text-ink underline underline-offset-2"
          >
            {t("analyseLayout.reset")}
          </button>
        )}
      </div>

      {orderedSections.map((s) => (
        <SectionShell
          key={s.id}
          id={s.id}
          title={s.title}
          action={s.action}
          interactive={interactive}
          collapsed={interactive && isCollapsed(s.id)}
          onToggle={() => toggleCollapse(s.id, visibleIds)}
          onReorder={(from, to) => move(visibleIds, from, to)}
        >
          {s.body}
        </SectionShell>
      ))}
    </div>
  );
}
