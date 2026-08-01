import { StatCard } from "@/components/ui/StatCard";
import type { DisciplineImpact } from "@/lib/stats";

interface DisciplineImpactCardsProps {
  impact: DisciplineImpact;
  /**
   * Missed trades only exist in the live Journal — a backtest project never
   * offers that evaluation, so its scope hides the missed card entirely.
   */
  showMissed?: boolean;
  compact?: boolean;
}

function signedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

/**
 * The two "discipline cost" insight cards — what execution errors and missed
 * setups did to the result. Auto-computed from trade_evaluation + resultaat_pct
 * so the trader no longer has to tally this by hand in a review.
 */
export function DisciplineImpactCards({ impact, showMissed = true, compact = false }: DisciplineImpactCardsProps) {
  const { takenCount, errorCount, errorRate, errorResultPct, errorCostPct, missedCount, missedResultPct } = impact;

  const errorSub = errorCount
    ? `${errorCount}/${takenCount} trades (${Math.round(errorRate * 100)}%) · zonder: ${signedPct(errorCostPct)}`
    : "Geen errors — netjes uitgevoerd";

  return (
    <>
      <StatCard
        label="Resultaat door errors"
        value={signedPct(errorResultPct)}
        tone={errorResultPct < 0 ? "down" : errorResultPct > 0 ? "up" : "neutral"}
        sub={errorSub}
        compact={compact}
      />
      {showMissed && (
        <StatCard
          label="Gemiste winst"
          value={signedPct(missedResultPct)}
          tone={missedResultPct > 0 ? "down" : "neutral"}
          sub={missedCount ? `${missedCount} missed trade(s)` : "Geen gemiste setups"}
          compact={compact}
        />
      )}
    </>
  );
}
