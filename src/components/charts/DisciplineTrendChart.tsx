import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";
import type { DisciplinePoint } from "@/lib/stats";

/** Cumulative "% good trades" over the chronological sequence of graded trades. */
export function DisciplineTrendChart({ data }: { data: DisciplinePoint[] }) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center">
        <p className="font-body text-sm text-muted">{t("journal.disciplineEmpty")}</p>
      </div>
    );
  }

  // A single point has nothing to draw a line between. Duplicate it at idx 0 so
  // it reads as a flat line at its rate — never a synthetic 0% baseline, which
  // would wrongly imply the trader started at zero discipline.
  const chartData = data.length === 1 ? [{ ...data[0], idx: 0 }, data[0]] : data;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="rgb(var(--color-border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="idx"
          tick={{ fill: "rgb(var(--color-muted))", fontSize: 11, fontFamily: "IBM Plex Mono" }}
          axisLine={{ stroke: "rgb(var(--color-border))" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
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
          formatter={(v: number) => [`${v}%`, t("journal.disciplineTooltip")]}
          labelFormatter={(l) => t("journal.disciplineTradeLabel", { n: l })}
        />
        <Line type="monotone" dataKey="cumRate" stroke="rgb(var(--color-gold))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
