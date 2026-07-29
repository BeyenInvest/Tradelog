import { Card } from "./Card";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "up" | "down" | "neutral";
}

const TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  up: "text-win",
  down: "text-loss",
  neutral: "text-ink",
};

export function StatCard({ label, value, sub, tone = "neutral" }: StatCardProps) {
  return (
    <Card>
      <p className="font-body text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`font-mono text-3xl mt-2 ${TONE_CLASS[tone]}`}>{value}</p>
      {sub && <p className="font-body text-xs mt-1 text-muted">{sub}</p>}
    </Card>
  );
}
