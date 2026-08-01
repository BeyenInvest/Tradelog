import { StatCard } from "@/components/ui/StatCard";
import { WinRatePieChart } from "@/components/charts/WinRatePieChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { computeOverviewKpis, computeEquityCurve, round2 } from "@/lib/stats";
import type { Trade } from "@/lib/types";

function signedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

/**
 * The "Results" block for a review detail: the real numbers (trades, total
 * result, avg RR) + win-rate gauge + equity curve — not just the lone equity
 * curve the reviews used to show. Runs on taken trades only; missed trades
 * carry a hypothetical result and never dilute review performance.
 *
 * Avg RR = total result / decisive trades (wins + losses, BE excluded), the
 * average R booked per trade that actually resolved.
 */
export function ReviewStatsHeader({ taken }: { taken: Trade[] }) {
  if (taken.length === 0) return null;

  const kpis = computeOverviewKpis(taken);
  const equityData = computeEquityCurve(taken);
  const decisive = kpis.wins + kpis.losses;
  const avgRR = decisive > 0 ? round2(kpis.totalResultaat / decisive) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Trades" value={kpis.totalTrades} compact />
        <StatCard
          label="Totaal resultaat"
          value={signedPct(kpis.totalResultaat)}
          tone={kpis.totalResultaat >= 0 ? "up" : "down"}
          compact
        />
        <StatCard label="Gem. RR" value={signedPct(avgRR)} tone={avgRR >= 0 ? "up" : "down"} compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface-2 p-4 flex flex-col items-center">
          <p className="font-body text-xs uppercase tracking-wider text-muted self-start mb-2">Win rate</p>
          <WinRatePieChart wins={kpis.wins} be={kpis.be} losses={kpis.losses} size={148} />
          <div className="flex gap-4 mt-3 font-mono text-xs">
            <span className="text-win">{kpis.wins}W</span>
            <span className="text-be">{kpis.be}BE</span>
            <span className="text-loss">{kpis.losses}L</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface-2 p-4 lg:col-span-2">
          <p className="font-body text-xs uppercase tracking-wider text-muted mb-2">Cumulatief resultaat</p>
          <EquityCurveChart data={equityData} />
        </div>
      </div>
    </div>
  );
}
