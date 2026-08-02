import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { EquityPoint } from "@/lib/stats";

export function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  // A single point has nothing to draw a line between — Recharts just renders a dot.
  // Prepend a synthetic zero-baseline point so it reads as a line from start to result.
  const chartData = data.length === 1 ? [{ ...data[0], idx: 0, cum: 0 }, data[0]] : data;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-gold))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="rgb(var(--color-gold))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgb(var(--color-border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="idx"
          tick={{ fill: "rgb(var(--color-muted))", fontSize: 11, fontFamily: "IBM Plex Mono" }}
          axisLine={{ stroke: "rgb(var(--color-border))" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgb(var(--color-muted))", fontSize: 11, fontFamily: "IBM Plex Mono" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "rgb(var(--color-surface-2))",
            border: "1px solid rgb(var(--color-border))",
            borderRadius: 8,
            fontFamily: "IBM Plex Mono",
            fontSize: 12,
          }}
          labelStyle={{ color: "rgb(var(--color-muted))" }}
          formatter={(v: number) => [`${v}%`, "Cumulatief"]}
          labelFormatter={(l) => `Trade #${l}`}
        />
        <Area type="monotone" dataKey="cum" stroke="rgb(var(--color-gold))" strokeWidth={2} fill="url(#cumFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
