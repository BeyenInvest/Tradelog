import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { computeConditionGaps, computeEvaluationImpact, type ConditionDimension, type ClosedTrade } from "@/lib/stats";
import { MIN_SAMPLE_SIZE, type GradedEvaluation } from "@/lib/constants";
import { formatAggregate } from "@/lib/format";

export interface AdherenceDimension extends ConditionDimension {
  /** Already-translated card title for this dimension (breakdown.<id> or the custom field's own label). */
  title: string;
  /** Translates a value key into its display label (weekdays, Ja/Nee); omitted → key shown as-is. */
  labelFn?: (key: string) => string;
}

const EVAL_LABEL_KEY: Record<GradedEvaluation, string> = {
  "Good trade": "adherence.evalGood",
  "Emotional error": "adherence.evalEmotional",
  "Technical error": "adherence.evalTechnical",
};

/** How many condition gaps to show — the ranking's point is the top offenders, not an exhaustive list. */
const MAX_GAPS = 5;

const fmtR = (v: number) => formatAggregate(v, "R");
/** App-wide sign semantics: green = profit, red = loss — never colored by ranking position. */
const signClass = (v: number) => (v > 0 ? "text-win" : v < 0 ? "text-loss" : "text-be");

/**
 * Fase N2 "Regel-adherentie": what does deviating from your own rules cost?
 * Two cards — self-evaluation (trade_evaluation) linked to avg R, and the
 * per-dimension best/worst value gaps — both computed by src/lib/stats/adherence.ts.
 * Beta-gated by the caller. Renders nothing while there's no measurable data
 * (e.g. a backtest project, where trade_evaluation isn't selectable, with too
 * few trades per value for a gap).
 */
export function AdherenceSection({ trades, dims, hideHeading = false }: { trades: ClosedTrade[]; dims: AdherenceDimension[]; hideHeading?: boolean }) {
  const { t } = useTranslation();
  const impact = useMemo(() => computeEvaluationImpact(trades), [trades]);
  const gaps = useMemo(() => computeConditionGaps(trades, dims).slice(0, MAX_GAPS), [trades, dims]);

  const dimById = new Map(dims.map((d) => [d.id, d]));
  const valueLabel = (dimId: string, key: string) => {
    const dim = dimById.get(dimId);
    return dim?.labelFn ? dim.labelFn(key) : key;
  };

  if (impact.graded === 0 && gaps.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      {!hideHeading && <h2 className="font-display text-xl italic text-ink">{t("adherence.heading")}</h2>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {impact.graded > 0 && (
          <Card>
            <h3 className="font-display text-lg italic mb-3 text-ink">{t("adherence.evalTitle")}</h3>
            <div className="overflow-x-auto">
              <div className="flex flex-col min-w-[420px]">
                <div className="grid grid-cols-5 gap-2 font-body text-[10px] uppercase tracking-wide pb-1.5 mb-1.5 text-muted border-b border-border">
                  <span />
                  <span className="text-right">{t("adherence.colTrades")}</span>
                  <span className="text-right">{t("adherence.colWin")}</span>
                  <span className="text-right">{t("adherence.colAvgR")}</span>
                  <span className="text-right">{t("adherence.colTotalR")}</span>
                </div>
                {impact.buckets
                  .filter((b) => b.n > 0)
                  .map((b) => (
                    <div key={b.evaluation} className="grid grid-cols-5 gap-2 font-mono text-xs py-1.5 items-center border-b border-border-soft">
                      <span className="text-ink font-body truncate">{t(EVAL_LABEL_KEY[b.evaluation])}</span>
                      <span className="text-right text-muted">{b.n}</span>
                      <span className="text-right text-win">{(b.winRate * 100).toFixed(0)}%</span>
                      <span className={clsx("text-right", b.avgR != null ? signClass(b.avgR) : "text-be")}>
                        {b.avgR != null ? fmtR(b.avgR) : "—"}
                      </span>
                      <span className={clsx("text-right", signClass(b.totalR))}>{fmtR(b.totalR)}</span>
                    </div>
                  ))}
              </div>
            </div>
            {impact.avgRGap != null && impact.goodAvgR != null && impact.errorAvgR != null ? (
              <div className="mt-3 flex flex-col gap-1">
                <p className="font-body text-sm text-ink">
                  {t("adherence.gapSummary", { good: fmtR(impact.goodAvgR), error: fmtR(impact.errorAvgR), gap: fmtR(impact.avgRGap) })}
                </p>
                {impact.avgRGap > 0 && impact.estimatedCostR != null && (
                  <p className="font-body text-sm text-muted">
                    {t("adherence.gapCost", { count: impact.errorN, total: fmtR(impact.estimatedCostR) })}
                  </p>
                )}
              </div>
            ) : (
              // The gap needs both sides: name the side that's actually missing.
              <p className="mt-3 font-body text-sm text-muted">
                {t(impact.errorN === 0 ? "adherence.noErrors" : "adherence.noGood")}
              </p>
            )}
          </Card>
        )}

        {gaps.length > 0 && (
          <Card>
            <h3 className="font-display text-lg italic mb-1 text-ink">{t("adherence.condTitle")}</h3>
            <p className="font-body text-xs text-muted mb-3">{t("adherence.condIntro", { min: MIN_SAMPLE_SIZE })}</p>
            <div className="flex flex-col">
              {gaps.map((gap) => {
                const best = gap.rows[0];
                const worst = gap.rows[gap.rows.length - 1];
                return (
                  <div key={gap.dimensionId} className="py-2.5 border-b border-border-soft last:border-b-0 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-body text-sm text-ink">{dimById.get(gap.dimensionId)?.title ?? gap.dimensionId}</span>
                      <span className="font-mono text-xs text-gold whitespace-nowrap">{t("adherence.condGapBadge", { gap: fmtR(gap.gapR) })}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-xs">
                      <span>
                        <span className="text-muted font-body">{t("adherence.condBest")}: </span>
                        <span className="text-ink">{valueLabel(gap.dimensionId, best.key)}</span>{" "}
                        <span className={signClass(best.avgR)}>{t("adherence.condAvg", { avg: fmtR(best.avgR), n: best.n })}</span>
                      </span>
                      <span>
                        <span className="text-muted font-body">{t("adherence.condWorst")}: </span>
                        <span className="text-ink">{valueLabel(gap.dimensionId, worst.key)}</span>{" "}
                        <span className={signClass(worst.avgR)}>{t("adherence.condAvg", { avg: fmtR(worst.avgR), n: worst.n })}</span>
                      </span>
                    </div>
                    {worst.errorRate != null && worst.errorRate > 0 && (
                      <p className="font-body text-xs text-muted">
                        {t("adherence.condErrorNote", {
                          rate: (worst.errorRate * 100).toFixed(0),
                          label: valueLabel(gap.dimensionId, worst.key),
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}
