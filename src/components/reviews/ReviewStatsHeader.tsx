import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/ui/StatCard";
import { WinRatePieChart } from "@/components/charts/WinRatePieChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { computeOverviewKpis, computeEquityCurve, round2 } from "@/lib/stats";
import type { Trade } from "@/lib/types";

type View = "taken" | "missed";

function signedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

/**
 * The "Resultaat" block for a review detail: the real numbers (trades, total
 * result, avg RR) + win-rate gauge + equity curve, with a Genomen/Missed
 * toggle. There is no combined "Beide" view — missed trades are hypothetical
 * and must never be blended into real performance numbers (resultaat,
 * win-rate, streaks, equity curve), so each tab is computed in isolation.
 * Avg RR = total result / decisive trades (wins + losses, BE excluded).
 */
export function ReviewStatsHeader({ taken, missed }: { taken: Trade[]; missed: Trade[] }) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("taken");
  const hasMissed = missed.length > 0;

  if (taken.length === 0 && missed.length === 0) return null;

  const rows = view === "taken" ? taken : missed;
  const kpis = computeOverviewKpis(rows);
  const equityData = computeEquityCurve(rows);
  const decisive = kpis.wins + kpis.losses;
  const avgRR = decisive > 0 ? round2(kpis.totalResultaat / decisive) : 0;

  const options: { key: View; label: string }[] = [
    { key: "taken", label: t("reviews.taken") },
    { key: "missed", label: t("reviews.missed") },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-xs uppercase tracking-wider text-gold">{t("reviews.resultHeading")}</p>
        {hasMissed && (
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => setView(o.key)}
                className={`px-3 py-1.5 text-xs font-body transition-colors ${
                  view === o.key ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("reviews.trades")} value={kpis.totalTrades} compact />
        <StatCard
          label={t("reviews.totalResult")}
          value={signedPct(kpis.totalResultaat)}
          tone={kpis.totalResultaat >= 0 ? "up" : "down"}
          compact
        />
        <StatCard label={t("reviews.avgRR")} value={signedPct(avgRR)} tone={avgRR >= 0 ? "up" : "down"} compact />
      </div>

      {rows.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-surface-2 p-4 flex flex-col items-center">
            <p className="font-body text-xs uppercase tracking-wider text-muted self-start mb-2">{t("journal.winRate")}</p>
            <WinRatePieChart wins={kpis.wins} be={kpis.be} losses={kpis.losses} size={148} />
            <div className="flex gap-4 mt-3 font-mono text-xs">
              <span className="text-win">{kpis.wins}W</span>
              <span className="text-be">{kpis.be}BE</span>
              <span className="text-loss">{kpis.losses}L</span>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-4 lg:col-span-2">
            <p className="font-body text-xs uppercase tracking-wider text-muted mb-2">{t("journal.cumulativeResult")}</p>
            <EquityCurveChart data={equityData} />
          </div>
        </div>
      ) : (
        <p className="font-body text-sm text-muted">{t("reviews.noTradesInView")}</p>
      )}
    </section>
  );
}
