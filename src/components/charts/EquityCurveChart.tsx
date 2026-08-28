import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from "recharts";
import { useTranslation } from "react-i18next";
import { computeEquityCurve, computeMaxDrawdown, type ClosedTrade } from "@/lib/stats";
import { formatAggregate, tradesInResultUnit } from "@/lib/format";
import { useResultDisplay } from "@/hooks/useResultDisplay";

/**
 * Cumulative equity curve (running sum of resultaat_pct). Takes the already-scoped,
 * missed-decided trade list (Reviews plots missed rows here) and computes the curve
 * itself — callers always pass raw %-trades; de resultaat-eenheid-conversie (Fase J)
 * gebeurt hier intern, zodat elke plek met deze chart automatisch meeschakelt.
 *
 * Marks the max-drawdown peak → trough (Fase S1): both the drawdown and the curve
 * are computed from the SAME unit-converted list, so their trade ids and cum
 * values line up exactly. `showDrawdownMarkers` lets a caller suppress them.
 */
export function EquityCurveChart({ trades, showDrawdownMarkers = true }: { trades: ClosedTrade[]; showDrawdownMarkers?: boolean }) {
  const { t } = useTranslation();
  const { unit: resultUnit, saldo } = useResultDisplay();
  const converted = useMemo(() => tradesInResultUnit(trades, resultUnit, saldo), [trades, resultUnit, saldo]);
  const data = useMemo(() => computeEquityCurve(converted), [converted]);
  // Peak/trough of the deepest drawdown, positioned by matching the drawdown's
  // trade ids back to their point in the (identically computed) curve.
  const drawdownMarkers = useMemo(() => {
    if (!showDrawdownMarkers) return null;
    const dd = computeMaxDrawdown(converted);
    if (dd.maxDrawdownPct <= 0 || dd.troughTradeId == null) return null;
    const trough = data.find((p) => p.tradeId === dd.troughTradeId);
    if (!trough) return null;
    const peak = dd.peakTradeId != null ? data.find((p) => p.tradeId === dd.peakTradeId) ?? null : null;
    return { peak, trough, depth: dd.maxDrawdownPct };
  }, [showDrawdownMarkers, converted, data]);

  if (data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center">
        <p className="font-body text-sm text-muted">{t("chart.equityEmpty")}</p>
      </div>
    );
  }

  // Anchor the curve on a synthetic trade-0 zero-baseline point, so the first
  // trade reads as a line rising from 0 instead of the curve "starting high" at
  // its already-accumulated value (which looked misleadingly flat with few
  // trades). Display-only: computeEquityCurve stays pure, and the drawdown
  // markers match on tradeId against `data`, so idx 0 never collides.
  const chartData = [{ ...data[0], idx: 0, cum: 0 }, ...data];

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
            formatter={(v: number) => [formatAggregate(v, resultUnit), t("chart.equityTooltip")]}
            labelFormatter={(l) => t("chart.equityTradeLabel", { n: l })}
          />
          <Area type="monotone" dataKey="cum" stroke="rgb(var(--color-gold))" strokeWidth={2} fill="url(#cumFill)" />
          {drawdownMarkers?.peak && (
            <ReferenceDot
              x={drawdownMarkers.peak.idx}
              y={drawdownMarkers.peak.cum}
              r={4}
              fill="rgb(var(--color-surface))"
              stroke="rgb(var(--color-muted))"
              strokeWidth={2}
              isFront
            />
          )}
          {drawdownMarkers && (
            <ReferenceDot
              x={drawdownMarkers.trough.idx}
              y={drawdownMarkers.trough.cum}
              r={4}
              fill="rgb(var(--color-loss))"
              stroke="rgb(var(--color-surface))"
              strokeWidth={2}
              isFront
              label={{
                value: formatAggregate(-drawdownMarkers.depth, resultUnit, { decimals: resultUnit === "currency" ? 0 : 1 }),
                position: "bottom",
                fill: "rgb(var(--color-loss))",
                fontSize: 11,
                fontFamily: "IBM Plex Mono",
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
