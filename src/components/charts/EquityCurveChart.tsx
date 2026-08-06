import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";
import { computeEquityCurve, type EquityMode } from "@/lib/stats";
import type { Trade } from "@/lib/types";

/**
 * Cumulative equity curve with a simple/compound toggle. Takes the already-scoped,
 * missed-decided trade list (Reviews plots missed rows here) and computes the curve
 * itself so the toggle state lives in one place across every view that renders it.
 */
export function EquityCurveChart({ trades }: { trades: Trade[] }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EquityMode>("simple");
  const data = useMemo(() => computeEquityCurve(trades, mode), [trades, mode]);

  const modes: { key: EquityMode; label: string }[] = [
    { key: "simple", label: t("chart.equityModeSimple") },
    { key: "compound", label: t("chart.equityModeCompound") },
  ];

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

  return (
    <div>
      <div className="flex justify-end mb-2">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`px-3 py-1 text-xs font-body transition-colors ${
                mode === m.key ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
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
            formatter={(v: number) => [`${v}%`, t("chart.equityTooltip")]}
            labelFormatter={(l) => t("chart.equityTradeLabel", { n: l })}
          />
          <Area type="monotone" dataKey="cum" stroke="rgb(var(--color-gold))" strokeWidth={2} fill="url(#cumFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
