import clsx from "clsx";
import { useTranslation } from "react-i18next";
import type { BreakdownRowWithFaseSplit } from "@/lib/stats";
import { FASES } from "@/lib/constants";
import { Card } from "@/components/ui/Card";
import { formatAggregate } from "@/lib/format";
import { useResultUnit } from "@/hooks/useResultUnit";

interface BreakdownGridProps {
  title: string;
  /** Moet al in de actieve resultaat-eenheid staan (caller: tradesInResultUnit vóór breakdownByWithFaseSplit) — hier alleen de formattering. */
  rows: BreakdownRowWithFaseSplit<string>[];
}

/** "Per Fase-opsplitsing": same dimension, Fase 1-4 shown side by side. */
export function BreakdownGrid({ title, rows }: BreakdownGridProps) {
  const { t } = useTranslation();
  const resultUnit = useResultUnit();
  return (
    <Card>
      <h3 className="font-display text-lg italic mb-3 text-ink">{title} — {t("breakdown.perFaseSuffix")}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("breakdown.noData")}</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid gap-2 font-body text-[10px] uppercase tracking-wide pb-1.5 mb-1.5 text-muted border-b border-border" style={{ gridTemplateColumns: `1.5fr repeat(${FASES.length}, 1fr)` }}>
            <span>{t("breakdown.colValue")}</span>
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
                  <span
                    key={f}
                    className={clsx(
                      "text-right",
                      cell.resultaatTotal > 0 ? "text-win" : cell.resultaatTotal < 0 ? "text-loss" : "text-be"
                    )}
                  >
                    {cell.n ? formatAggregate(cell.resultaatTotal, resultUnit) : "—"}
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
