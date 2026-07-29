import type { EconomicImpact } from "@/lib/economicCalendar";

const IMPACT_STYLE: Record<EconomicImpact, { bg: string; fg: string }> = {
  Low: { bg: "rgba(139,147,167,0.14)", fg: "#8B93A7" },
  Medium: { bg: "rgba(212,166,74,0.16)", fg: "#D4A64A" },
  High: { bg: "rgba(224,102,90,0.16)", fg: "#E0665A" },
  Holiday: { bg: "rgba(139,147,167,0.14)", fg: "#8B93A7" },
};

export function ImpactBadge({ impact }: { impact: EconomicImpact }) {
  const style = IMPACT_STYLE[impact] ?? IMPACT_STYLE.Low;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] uppercase tracking-wide"
      style={{ background: style.bg, color: style.fg }}
    >
      {impact}
    </span>
  );
}
