import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { BreakdownRow } from "@/lib/stats";

export function FaseBarChart({ data }: { data: BreakdownRow<string>[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#2A2D35" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#9A9CA5", fontSize: 12, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: "#2A2D35" }} tickLine={false} />
        <YAxis tick={{ fill: "#9A9CA5", fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          contentStyle={{ background: "#22242B", border: "1px solid #2A2D35", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12 }}
          formatter={(v: number) => [`${v}%`, "Resultaat"]}
          labelStyle={{ color: "#9A9CA5" }}
        />
        <Bar dataKey="resultaatTotal" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.resultaatTotal >= 0 ? "#5FAE82" : "#E0665A"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
