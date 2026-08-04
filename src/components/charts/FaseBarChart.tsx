import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { BreakdownRow } from "@/lib/stats";

export function FaseBarChart({ data }: { data: BreakdownRow<string>[] }) {
  if (data.every((d) => d.n === 0)) {
    return (
      <div className="h-[220px] flex items-center justify-center">
        <p className="font-body text-sm text-muted">Nog geen trades per fase.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="rgb(var(--color-border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "rgb(var(--color-muted))", fontSize: 12, fontFamily: "IBM Plex Mono" }}
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
          formatter={(v: number) => [`${v}%`, "Resultaat"]}
          labelStyle={{ color: "rgb(var(--color-muted))" }}
        />
        <Bar dataKey="resultaatTotal" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.resultaatTotal >= 0 ? "rgb(var(--color-win))" : "rgb(var(--color-loss))"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
