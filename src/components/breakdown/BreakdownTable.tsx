import type { BreakdownRow } from "@/lib/stats";
import { Card } from "@/components/ui/Card";
import { SampleSizeBadge } from "@/components/ui/SampleSizeBadge";

interface BreakdownTableProps {
  title: string;
  rows: BreakdownRow<string>[];
}

/** Generic table for any "Per X" split — every dimension renders through this, config-driven. */
export function BreakdownTable({ title, rows }: BreakdownTableProps) {
  return (
    <Card>
      <h3 className="font-display text-lg italic mb-3 text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Geen data.</p>
      ) : (
        <div className="overflow-x-auto">
        <div className="flex flex-col min-w-[420px]">
          <div className="grid grid-cols-5 gap-2 font-body text-[10px] uppercase tracking-wide pb-1.5 mb-1.5 text-muted border-b border-border">
            <span>Waarde</span>
            <span className="text-right">Trades</span>
            <span className="text-right">Resultaat</span>
            <span className="text-right">Win%</span>
            <span className="text-right">Loss%</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.key}
              className={`grid grid-cols-5 gap-2 font-mono text-xs py-1.5 items-center border-b border-border-soft ${
                r.isLowSample ? "opacity-40" : ""
              }`}
            >
              <span className="text-ink font-body truncate flex items-center gap-1.5">
                {r.label}
                {r.isLowSample && <SampleSizeBadge n={r.n} />}
              </span>
              <span className="text-right text-muted">{r.n}</span>
              <span
                className="text-right"
                style={{ color: r.resultaatTotal > 0 ? "#5FAE82" : r.resultaatTotal < 0 ? "#E0665A" : "#8B93A7" }}
              >
                {r.resultaatTotal > 0 ? "+" : ""}
                {r.resultaatTotal}%
              </span>
              <span className="text-right text-win">{(r.winRate * 100).toFixed(0)}%</span>
              <span className="text-right text-loss">{(r.lossRate * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
        </div>
      )}
    </Card>
  );
}
