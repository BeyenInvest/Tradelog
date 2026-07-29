import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { EquityPoint } from "@/lib/stats";

export function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4A64A" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#D4A64A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#2A2D35" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="idx"
          tick={{ fill: "#9A9CA5", fontSize: 11, fontFamily: "IBM Plex Mono" }}
          axisLine={{ stroke: "#2A2D35" }}
          tickLine={false}
        />
        <YAxis tick={{ fill: "#9A9CA5", fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          contentStyle={{ background: "#22242B", border: "1px solid #2A2D35", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12 }}
          labelStyle={{ color: "#9A9CA5" }}
          formatter={(v: number) => [`${v}%`, "Cumulatief"]}
          labelFormatter={(l) => `Trade #${l}`}
        />
        <Area type="monotone" dataKey="cum" stroke="#D4A64A" strokeWidth={2} fill="url(#cumFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
