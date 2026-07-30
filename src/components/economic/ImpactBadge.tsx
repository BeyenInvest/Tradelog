import type { EconomicImpact } from "@/lib/economicCalendar";

const IMPACT_STYLE: Record<EconomicImpact, string> = {
  Low: "bg-be/15 text-be",
  Medium: "bg-gold/15 text-gold",
  High: "bg-loss/15 text-loss",
  Holiday: "bg-be/15 text-be",
};

export function ImpactBadge({ impact }: { impact: EconomicImpact }) {
  const className = IMPACT_STYLE[impact] ?? IMPACT_STYLE.Low;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] uppercase tracking-wide ${className}`}
    >
      {impact}
    </span>
  );
}
