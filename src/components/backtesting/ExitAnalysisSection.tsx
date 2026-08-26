import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { computeExitStats, type ExitTrade } from "@/lib/stats";
import { formatAggregate } from "@/lib/format";

const fmtR = (v: number) => formatAggregate(v, "R");
/** MAE is heat (adverse), shown as a plain positive magnitude — "0.45R", no sign prefix. */
const fmtHeat = (v: number) => `${v.toFixed(2)}R`;
const pct0 = (rate: number) => `${(rate * 100).toFixed(0)}%`;
/** App-wide sign semantics: green = profit, red = loss. */
const signClass = (v: number) => (v > 0 ? "text-win" : v < 0 ? "text-loss" : "text-be");

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border-soft last:border-b-0">
      <span className="font-body text-sm text-muted">{label}</span>
      <span className="font-mono text-sm text-ink whitespace-nowrap">{children}</span>
    </div>
  );
}

/**
 * Fase N3 "Exit-analyse": what do the optional MAE/MFE/planned-R:R columns say
 * about stop placement and exit timing? Three cards — stop-analyse (MAE),
 * exit-efficiëntie (MFE) and plan vs. realisatie (planned R:R) — each rendered
 * only when its own data exists; the whole section disappears while no trade
 * tracks any of the three (all math in src/lib/stats/exit.ts). Beta-gated by
 * the caller. Caller passes the same missed-excluded closed list every other
 * realized stat reads.
 */
export function ExitAnalysisSection({ trades, hideHeading = false }: { trades: ExitTrade[]; hideHeading?: boolean }) {
  const { t } = useTranslation();
  const stats = useMemo(() => computeExitStats(trades), [trades]);

  if (stats.nMae === 0 && stats.nMfe === 0 && stats.nPlanned === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {!hideHeading && <h2 className="font-display text-xl italic text-ink">{t("exitAnalysis.heading")}</h2>}
        <p className="font-body text-xs text-muted">
          {t("exitAnalysis.intro")}
          {stats.assumedRiskN > 0 && <> {t("exitAnalysis.assumedRiskNote", { count: stats.assumedRiskN })}</>}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {stats.nMae > 0 && (
          <Card>
            <h3 className="font-display text-lg italic mb-1 text-ink">{t("exitAnalysis.maeTitle")}</h3>
            <p className="font-body text-xs text-muted mb-3">{t("exitAnalysis.maeIntro", { n: stats.nMae })}</p>
            <div className="flex flex-col">
              <Row label={t("exitAnalysis.maeWinners", { n: stats.nMaeWinners })}>
                {stats.avgMaeRWinners != null ? fmtHeat(stats.avgMaeRWinners) : "—"}
              </Row>
              <Row label={t("exitAnalysis.maeLosers", { n: stats.nMaeLosers })}>
                {stats.avgMaeRLosers != null ? fmtHeat(stats.avgMaeRLosers) : "—"}
              </Row>
              <Row label={t("exitAnalysis.maeWorstWinner")}>
                {stats.maxMaeRWinners != null ? fmtHeat(stats.maxMaeRWinners) : "—"}
              </Row>
            </div>
            {stats.maxMaeRWinners != null && stats.maxMaeRWinners < 1 && (
              <p className="mt-3 font-body text-sm text-muted">
                {t("exitAnalysis.maeStopInsight", { heat: fmtHeat(stats.maxMaeRWinners) })}
              </p>
            )}
          </Card>
        )}

        {stats.nMfe > 0 && (
          <Card>
            <h3 className="font-display text-lg italic mb-1 text-ink">{t("exitAnalysis.mfeTitle")}</h3>
            <p className="font-body text-xs text-muted mb-3">{t("exitAnalysis.mfeIntro", { n: stats.nMfe })}</p>
            <div className="flex flex-col">
              <Row label={t("exitAnalysis.captureRate")}>
                {stats.captureRate != null ? (
                  <span className={clsx(signClass(stats.captureRate))}>{pct0(stats.captureRate)}</span>
                ) : (
                  "—"
                )}
              </Row>
              <Row label={t("exitAnalysis.losersInProfit")}>{stats.losersInProfitN}</Row>
              <Row label={t("exitAnalysis.loserPeak")}>
                {stats.avgLoserPeakR != null ? `+${stats.avgLoserPeakR.toFixed(2)}R` : "—"}
              </Row>
            </div>
            {stats.losersInProfitN > 0 && stats.avgLoserPeakR != null && (
              <p className="mt-3 font-body text-sm text-muted">
                {t("exitAnalysis.givenBackInsight", { count: stats.losersInProfitN, peak: `+${stats.avgLoserPeakR.toFixed(2)}R` })}
              </p>
            )}
          </Card>
        )}

        {stats.nPlanned > 0 && (
          <Card>
            <h3 className="font-display text-lg italic mb-1 text-ink">{t("exitAnalysis.planTitle")}</h3>
            <p className="font-body text-xs text-muted mb-3">{t("exitAnalysis.planIntro", { n: stats.nPlanned })}</p>
            <div className="flex flex-col">
              <Row label={t("exitAnalysis.avgPlanned")}>
                {stats.avgPlannedRr != null ? `${stats.avgPlannedRr.toFixed(2)}R` : "—"}
              </Row>
              <Row label={t("exitAnalysis.avgRealized")}>
                {stats.avgRealizedRPlanned != null ? (
                  <span className={signClass(stats.avgRealizedRPlanned)}>{fmtR(stats.avgRealizedRPlanned)}</span>
                ) : (
                  "—"
                )}
              </Row>
              <Row label={t("exitAnalysis.targetHit")}>
                {stats.targetHitRate != null ? pct0(stats.targetHitRate) : "—"}
              </Row>
              <Row label={t("exitAnalysis.targetReached", { n: stats.nTargetTracked })}>
                {stats.targetReachedRate != null ? pct0(stats.targetReachedRate) : "—"}
              </Row>
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}
