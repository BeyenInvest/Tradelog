import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/ui/StatCard";
import { WinRatePieChart } from "@/components/charts/WinRatePieChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { computeOverviewKpis, round2, type ClosedTrade } from "@/lib/stats";
import { formatAggregate, pctToAmount, resultDisplayValue } from "@/lib/format";
import { useResultDisplay } from "@/hooks/useResultDisplay";

type View = "taken" | "missed";

/**
 * The "Resultaat" block for a review detail: the real numbers (trades, total
 * result, avg RR) + win-rate gauge + equity curve, with a Genomen/Missed
 * toggle. There is no combined "Beide" view — missed trades are hypothetical
 * and must never be blended into real performance numbers (resultaat,
 * win-rate, streaks, equity curve), so each tab is computed in isolation.
 * Avg result/trade = total result / all taken trades (a BE trade is a real
 * taken trade contributing 0%, so it belongs in the denominator — otherwise
 * the "trades" count and the per-trade average would contradict each other).
 */
export function ReviewStatsHeader({ taken, missed }: { taken: ClosedTrade[]; missed: ClosedTrade[] }) {
  const { t } = useTranslation();
  const { unit: resultUnit, saldo } = useResultDisplay();
  const [view, setView] = useState<View>("taken");
  const hasMissed = missed.length > 0;

  if (taken.length === 0 && missed.length === 0) return null;

  const rows = view === "taken" ? taken : missed;
  const kpis = computeOverviewKpis(rows);
  // Totaal + Ø RR in de gekozen eenheid, via de gedeelde fallback-regels: R
  // gebruikt kpis.totalR (zelfde som-dan-afronden als computeRStats), geld
  // pctToAmount, % het bestaande totaal. round2 is idempotent op de al-gerondde
  // %/R-waarden en normaliseert het geldbedrag.
  const shownTotal = round2(
    resultDisplayValue(kpis.totalResultaat, resultUnit, {
      rMultiple: kpis.totalR,
      amount: pctToAmount(kpis.totalResultaat, saldo),
    })
  );
  const avgRR = kpis.totalTrades > 0 ? round2(shownTotal / kpis.totalTrades) : 0;
  const signed = (n: number) => formatAggregate(n, resultUnit);

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
          value={signed(shownTotal)}
          tone={shownTotal >= 0 ? "up" : "down"}
          compact
        />
        <StatCard label={t("reviews.avgRR")} value={signed(avgRR)} tone={avgRR >= 0 ? "up" : "down"} compact />
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
            <EquityCurveChart trades={rows} />
          </div>
        </div>
      ) : (
        <p className="font-body text-sm text-muted">{t("reviews.noTradesInView")}</p>
      )}
    </section>
  );
}
