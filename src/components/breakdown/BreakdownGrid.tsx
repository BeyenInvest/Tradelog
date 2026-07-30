import clsx from "clsx";
import type { BreakdownRowWithFaseSplit } from "@/lib/stats";
import { FASES } from "@/lib/constants";
import { Card } from "@/components/ui/Card";
import { SampleSizeBadge } from "@/components/ui/SampleSizeBadge";

interface BreakdownGridProps {
  title: string;
  rows: BreakdownRowWithFaseSplit<string>[];
}

/** "Per Fase-opsplitsing": same dimension, Fase 1-4 shown side by side. */
export function BreakdownGrid({ title, rows }: BreakdownGridProps) {
  return (
    <Card>
      <h3 className="font-display text-lg italic mb-3 text-ink">{title} — per fase</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Geen data.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid gap-2 font-body text-[10px] uppercase tracking-wide pb-1.5 mb-1.5 text-muted border-b border-border" style={{ gridTemplateColumns: `1.5fr repeat(${FASES.length}, 1fr)` }}>
            <span>Waarde</span>
            {FASES.map((f) => (
              <span key={f} className="text-right">
                {f.replace("Fase ", "F")}
              </span>
            ))}
          </div>
          {rows.map((r) => (
            <div
              key={r.key}
              className="grid gap-2 font-mono text-xs py-1.5 items-center border-b border-border-soft"
              style={{ gridTemplateColumns: `1.5fr repeat(${FASES.length}, 1fr)` }}
            >
              <span className="text-ink font-body truncate">{r.label}</span>
              {FASES.map((f) => {
                const cell = r.byFase[f];
                return (
                  <span key={f} className={`text-right flex items-center justify-end gap-1 ${cell.isLowSample ? "opacity-40" : ""}`}>
                    <span className={clsx(cell.resultaatTotal > 0 ? "text-win" : cell.resultaatTotal < 0 ? "text-loss" : "text-be")}>
                      {cell.n ? `${cell.resultaatTotal > 0 ? "+" : ""}${cell.resultaatTotal}%` : "—"}
                    </span>
                    {cell.n > 0 && cell.isLowSample && <SampleSizeBadge n={cell.n} />}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
