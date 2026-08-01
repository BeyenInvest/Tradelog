import type { DisciplineImpact } from "@/lib/stats";
import { DisciplineImpactCards } from "@/components/trades/DisciplineImpactCards";
import { MarketCaptureLine } from "@/components/trades/MarketCaptureLine";

/**
 * Groups the discipline-cost cards (errors / missed) and the market-capture
 * synthesis under one labelled section, so the review reads as distinct zones
 * rather than a stack of loose cards. Renders nothing when the period had no
 * errors and no missed setups.
 */
export function ReviewDisciplineSection({ impact }: { impact: DisciplineImpact }) {
  if (impact.errorCount === 0 && impact.missedCount === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <p className="font-body text-xs uppercase tracking-wider text-gold">Discipline</p>
      <div className="grid grid-cols-2 gap-3">
        <DisciplineImpactCards impact={impact} showMissed={impact.missedCount > 0} compact />
      </div>
      <MarketCaptureLine impact={impact} />
    </section>
  );
}
