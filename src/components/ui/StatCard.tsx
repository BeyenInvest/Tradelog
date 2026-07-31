import { Card } from "./Card";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "up" | "down" | "neutral";
  /** Smaller card/value for secondary metrics that shouldn't compete with the primary KPI row. */
  compact?: boolean;
}

const TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  up: "text-win",
  down: "text-loss",
  neutral: "text-ink",
};

export function StatCard({ label, value, sub, tone = "neutral", compact = false }: StatCardProps) {
  return (
    <Card padding={compact ? "sm" : "default"}>
      <p className="font-body text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`font-mono ${compact ? "text-lg mt-1" : "text-3xl mt-2"} ${TONE_CLASS[tone]}`}>{value}</p>
      {sub && <p className="font-body text-xs mt-1 text-muted">{sub}</p>}
    </Card>
  );
}
