import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Flame } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { FaseBarChart } from "@/components/charts/FaseBarChart";
import { RDistributionChart } from "@/components/charts/RDistributionChart";
import { BreakdownTable } from "@/components/breakdown/BreakdownTable";
import { CrossTable, type CrossDim } from "@/components/breakdown/CrossTable";
import { SectionShell } from "@/components/analyse/SectionShell";
import { AdherenceSection, type AdherenceDimension } from "@/components/backtesting/AdherenceSection";
import { ExitAnalysisSection } from "@/components/backtesting/ExitAnalysisSection";
import { PeriodPicker } from "@/components/trades/PeriodPicker";
import { FilterPanel } from "@/components/trades/FilterPanel";
import {
  computeOverviewKpis, breakdownBy,
  computeDurationByOutcome, groupIntoSeries, takenTrades, closedTrades,
  computeRHistogram, computeRDistribution, computeEvaluationImpact, computeConditionGaps,
} from "@/lib/stats";
import { useAnalyseLayout } from "@/hooks/useAnalyseLayout";
import { BREAKDOWN_DIMENSIONS, customFieldDimensions, type DimensionConfig } from "@/lib/breakdownDimensions";
import { OUTCOMES } from "@/lib/constants";
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
  trades, methodologyOverride, showAdherence = false,
}: {
  trades: Trade[];
  /**
   * Admin read-only view passes the *viewed* user's journal (fields + is-forex)
   * here instead of the viewer's own useMethodology() — otherwise the breakdowns
   * would follow the admin's active journal, not the user's (H2).
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
  const { profile } = useAuth();
  const ownMethodology = useMethodology();
  // Admin read-only view supplies the viewed user's journal; every other call site
  // uses the signed-in user's own active methodology.
  const { fields, isForexJournal, trackExit } = methodologyOverride ?? ownMethodology;
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
  const duration = useMemo(() => computeDurationByOutcome(scopedTrades), [scopedTrades]);
  const series = useMemo(() => groupIntoSeries(displayTrades, 5), [displayTrades]);

  // Per-fase kaarten + "Resultaat per Fase"-bar (fase-retirement 0059): fase is nu
  // een gewoon config-veld, maar de WPM-specifieke fase-weergave blijft een eigen
  // laag bovenaan wanneer het journal een `fase`-enum-veld draagt. Leest de waarde
  // uit trades.custom.fase; de volgorde volgt de veld-opties (Fase 1-4). Fase krijgt
  // daarom hieronder GEEN gewone uitsplitsings-tabel (zou de kaarten dubbelen), maar
  // blijft wel een kruistabel-as.
  const faseField = useMemo(() => fields.find((f) => f.field_key === "fase" && f.field_type === "enum"), [fields]);
  const showFase = Boolean(faseField);
  const byFase = useMemo(
    () =>
      showFase
        ? breakdownBy(
            displayTrades,
            (tr) => {
              const raw = tr.custom?.fase;
              return raw == null || raw === "" ? null : String(raw);
            },
            { sortOrder: faseField?.options ?? undefined }
          )
        : [],
    [displayTrades, showFase, faseField]
  );

  // The fixed dimension list is universal since the fase-retirement (0059) — every
  // methodology-specific split (fase/cc/weekly/…) is a custom-field dimension below.
  const dimensions = BREAKDOWN_DIMENSIONS;
  // Per-dimension row-label translator: the breakdown key stays a stable id, the
  // label follows the UI language (weekday abbreviations, Yes/No). Omitted → key shown as-is.
  const labelFnFor = (d: DimensionConfig) =>
    d.labelFn ? (k: string) => d.labelFn!(k, t) : undefined;
  const dimensionRows = useMemo(
    () => dimensions.map((d) => ({ dim: d, rows: breakdownBy(displayTrades, d.keyFn, { sortOrder: d.sortOrder, labelFn: labelFnFor(d) }) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayTrades, t]
  );
  // Show a fixed dimension when it's universal, or forex-only on a forex journal.
  const showTimingDim = (dim: { universal?: boolean; forex?: boolean }) =>
    Boolean(dim.universal || (dim.forex && isForexJournal));
  // Skip dimensions with no data at all (rows.length 0) — e.g. "Per Richting"
  // before any trade carries a direction: an empty card is noise, and it appears by
  // itself as soon as the data exists.
  const timingDimRows = dimensionRows.filter(({ dim, rows }) => showTimingDim(dim) && rows.length > 0);

  // On a forex journal instrument mirrors pair, so the instrument split IS the pair
  // split — title it "Per Pair" there (the term forex traders think in); other
  // journals see the universal "Per Instrument".
  const timingDimTitle = (dimId: string) =>
    dimId === "instrument" && isForexJournal ? t("breakdown.pair") : t(`breakdown.${dimId}`);

  // Config-driven breakdowns for the active journal's own custom fields (cyclus 4),
  // read from the trades.custom bag — incl. the former WPM fields (fase/cc/…) since 0059.
  const customDims = useMemo(() => customFieldDimensions(fields, scopedTrades, t), [fields, scopedTrades, t]);
  const customDimRows = useMemo(
    () =>
      customDims
        .map((d) => ({ dim: d, rows: breakdownBy(displayTrades, d.keyFn, { sortOrder: d.sortOrder, labelFn: d.labelFn ? (k: string) => d.labelFn!(k, t) : undefined }) }))
        // Skip custom-field dimensions with no data yet (rows.length 0) — same as
        // timingDimRows above. A fresh preset journal defines many fields before any
        // trade fills them, which otherwise rendered a wall of empty "No data." cards.
        // Fase is skipped here on a WPM journal — it gets the dedicated cards + bar above.
        .filter(({ dim, rows }) => rows.length > 0 && !(showFase && dim.id === "custom:fase")),
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
        ...dimensions.filter((d) => showTimingDim(d) && !d.dateDerived),
        ...customDims,
      ].map((d) => ({
        id: d.id,
        title: d.label ?? timingDimTitle(d.id),
        keyFn: d.keyFn,
        labelFn: d.labelFn ? (k: string) => d.labelFn!(k, t) : undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isForexJournal, customDims, t]
  );

  // Kruistabel-dimensies (Fase S2, live voor iedereen — data-gated): exactly the
  // dimensions whose plain breakdowns render for this journal — the applicable
  // timing/instrument dims plus the journal's own custom fields (incl. the former
  // WPM fase/cc/… since 0059). Consumes the same DimensionConfig list, pre-resolving
  // each title + row-label translator so CrossTable stays free of dimension/i18n
  // knowledge (unlike adherence, this keeps the calendar-derived splits — Setup × Uur
  // is a genuine cross-tab).
  const crossDims = useMemo<CrossDim[]>(
    () =>
      [
        ...dimensions.filter(showTimingDim),
        ...customDims,
      ].map((d) => ({
        id: d.id,
        title: d.label ?? timingDimTitle(d.id),
        keyFn: d.keyFn,
        sortOrder: d.sortOrder,
        labelFn: d.labelFn ? (k: string) => d.labelFn!(k, t) : undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isForexJournal, customDims, t]
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
          {/* Streaks in één kaart, identiek aan de Journal-overzichtskaart (owner-wens:
              schoner dan drie losse StatCards). Hergebruikt dezelfde journal.*-teksten. */}
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
                    {kpis.currentStreak.count} {t(`journal.streakType_${kpis.currentStreak.type}`)}
                  </span>
                )}
              </p>
            </div>
          </Card>
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
        <div className="flex flex-col gap-5">
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
        </div>
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
      body: (
        <>
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-lg italic text-ink">{t("backtestingAnalysis.timingInstrumentHeading")}</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {timingDimRows.map(({ dim, rows }) => (
                <BreakdownTable key={dim.id} title={timingDimTitle(dim.id)} rows={rows} />
              ))}
            </div>
          </div>

          {/* Config-driven: the active journal's own custom fields (cyclus 4), incl.
              the former WPM fields (fase/cc/weekly/…) since the fase-retirement (0059). */}
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
