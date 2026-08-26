import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";
import type { RHistogramBin } from "@/lib/stats";

/**
 * R-multiple distribution histogram (Fase S2): one bar per R bin, height = number
 * of trades, coloured by the bin's mean-R sign (green = winning R, red = losing R).
 * `bins` come from computeRHistogram — always in R, independent of the %/R/$ display
 * toggle, since an R-distribution is inherently expressed in R.
 */
export function RDistributionChart({ bins, height = 172 }: { bins: RHistogramBin[]; height?: number }) {
  const { t } = useTranslation();
  if (bins.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="font-body text-sm text-muted">{t("rDistribution.empty")}</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={bins} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="rgb(var(--color-border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="key"
          tick={{ fill: "rgb(var(--color-muted))", fontSize: 11, fontFamily: "IBM Plex Mono" }}
          axisLine={{ stroke: "rgb(var(--color-border))" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "rgb(var(--color-muted))", fontSize: 11, fontFamily: "IBM Plex Mono" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: "rgb(var(--color-border))", opacity: 0.25 }}
          contentStyle={{
            background: "rgb(var(--color-surface-2))",
            border: "1px solid rgb(var(--color-border))",
            borderRadius: 8,
            fontFamily: "IBM Plex Mono",
            fontSize: 12,
          }}
          labelStyle={{ color: "rgb(var(--color-muted))" }}
          formatter={(v: number) => [v, t("rDistribution.tradesTooltip")]}
          labelFormatter={(l) => t("rDistribution.binLabel", { bin: l })}
        />
        <Bar dataKey="n" radius={[6, 6, 0, 0]}>
          {bins.map((b, i) => (
            <Cell
              key={i}
              fill={b.bin > 0 ? "rgb(var(--color-win))" : b.bin < 0 ? "rgb(var(--color-loss))" : "rgb(var(--color-be))"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
