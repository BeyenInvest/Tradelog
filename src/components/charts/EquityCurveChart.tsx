import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";
import { computeEquityCurve } from "@/lib/stats";
import type { Trade } from "@/lib/types";

/**
 * Cumulative equity curve (running sum of resultaat_pct). Takes the already-scoped,
 * missed-decided trade list (Reviews plots missed rows here) and computes the curve
 * itself.
 */
export function EquityCurveChart({ trades }: { trades: Trade[] }) {
  const { t } = useTranslation();
  const data = useMemo(() => computeEquityCurve(trades), [trades]);

  if (data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center">
        <p className="font-body text-sm text-muted">{t("chart.equityEmpty")}</p>
      </div>
    );
  }

  // A single point has nothing to draw a line between — Recharts just renders a dot.
  // Prepend a synthetic zero-baseline point so it reads as a line from start to result.
  const chartData = data.length === 1 ? [{ ...data[0], idx: 0, cum: 0 }, data[0]] : data;

  // Pin the Y-axis to the actual curve (always including the 0 breakeven line),
  // instead of letting Recharts' auto nice-ticks tack on an empty band below it.
  // A small early dip (e.g. -2%) was otherwise dragging a step-7 axis down to -7,
  // wasting the bottom quarter of the chart and exaggerating the drawdown.
  const cums = chartData.map((d) => d.cum);
  const lo = Math.min(0, ...cums);
  const hi = Math.max(0, ...cums);
  const yDomain: [number, number] = [Math.floor(lo), Math.ceil(hi + Math.max((hi - lo) * 0.08, 1))];

  return (
    <div>
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
            domain={yDomain}
            allowDecimals={false}
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
            formatter={(v: number) => [`${v}%`, t("chart.equityTooltip")]}
            labelFormatter={(l) => t("chart.equityTradeLabel", { n: l })}
          />
          <Area type="monotone" dataKey="cum" stroke="rgb(var(--color-gold))" strokeWidth={2} fill="url(#cumFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
