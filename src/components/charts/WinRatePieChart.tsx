import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface WinRatePieChartProps {
  wins: number;
  be: number;
  losses: number;
  size?: number;
}

const COLORS = { Win: "#5FAE82", BE: "#8B93A7", Loss: "#E0665A" };

export function WinRatePieChart({ wins, be, losses, size = 168 }: WinRatePieChartProps) {
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
            data={data.length ? data : [{ name: "Geen data", value: 1 }]}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={data.length > 1 ? 3 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {(data.length ? data : [{ name: "Geen data" }]).map((d, i) => (
              <Cell key={i} fill={COLORS[d.name as keyof typeof COLORS] ?? "#2A2D35"} />
            ))}
          </Pie>
          {data.length > 0 && (
            <Tooltip
              contentStyle={{ background: "#22242B", border: "1px solid #2A2D35", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12 }}
              itemStyle={{ color: "#F1EFEA" }}
              formatter={(value: number, name: string) => [`${value} (${total ? ((value / total) * 100).toFixed(0) : 0}%)`, name]}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-mono text-2xl text-ink">{(winRate * 100).toFixed(0)}%</span>
        <span className="font-body text-[10px] uppercase tracking-wider text-muted">win rate</span>
      </div>
    </div>
  );
}
