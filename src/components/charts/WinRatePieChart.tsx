import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";

interface WinRatePieChartProps {
  wins: number;
  be: number;
  losses: number;
  size?: number;
}

const COLORS = {
  Win: "rgb(var(--color-win))",
  BE: "rgb(var(--color-be))",
  Loss: "rgb(var(--color-loss))",
};

export function WinRatePieChart({ wins, be, losses, size = 168 }: WinRatePieChartProps) {
  const { t } = useTranslation();
  const total = wins + be + losses;
  const winRate = total ? wins / total : 0;
  const data = [
    { name: "Win", value: wins },
    { name: "BE", value: be },
    { name: "Loss", value: losses },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.length ? data : [{ name: t("common.noData"), value: 1 }]}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={data.length > 1 ? 3 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {(data.length ? data : [{ name: t("common.noData") }]).map((d, i) => (
              <Cell key={i} fill={COLORS[d.name as keyof typeof COLORS] ?? "rgb(var(--color-border))"} />
            ))}
          </Pie>
          {data.length > 0 && (
            <Tooltip
              contentStyle={{
                background: "rgb(var(--color-surface-2))",
                border: "1px solid rgb(var(--color-border))",
                borderRadius: 8,
                fontFamily: "IBM Plex Mono",
                fontSize: 12,
              }}
              itemStyle={{ color: "rgb(var(--color-ink))" }}
              formatter={(value: number, name: string) => [`${value} (${total ? ((value / total) * 100).toFixed(0) : 0}%)`, name]}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-mono text-2xl text-ink">{total > 0 ? `${(winRate * 100).toFixed(0)}%` : "—"}</span>
        <span className="font-body text-[10px] uppercase tracking-wider text-muted">{t("journal.winRate")}</span>
      </div>
    </div>
  );
}
