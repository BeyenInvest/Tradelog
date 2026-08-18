import clsx from "clsx";
import { useTranslation } from "react-i18next";
import type { BreakdownRow } from "@/lib/stats";
import { Card } from "@/components/ui/Card";
import { formatAggregate } from "@/lib/format";
import { useResultUnit } from "@/hooks/useResultUnit";

interface BreakdownTableProps {
  title: string;
  /** Moet al in de actieve resultaat-eenheid staan (caller: tradesInResultUnit vóór breakdownBy) — hier alleen de formattering. */
  rows: BreakdownRow<string>[];
}

/** Generic table for any "Per X" split — every dimension renders through this, config-driven. */
export function BreakdownTable({ title, rows }: BreakdownTableProps) {
  const { t } = useTranslation();
  const resultUnit = useResultUnit();
  return (
    <Card>
      <h3 className="font-display text-lg italic mb-3 text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("breakdown.noData")}</p>
      ) : (
        <div className="overflow-x-auto">
        <div className="flex flex-col min-w-[420px]">
          <div className="grid grid-cols-5 gap-2 font-body text-[10px] uppercase tracking-wide pb-1.5 mb-1.5 text-muted border-b border-border">
            <span>{t("breakdown.colValue")}</span>
            <span className="text-right">{t("breakdown.colTrades")}</span>
            <span className="text-right">{t("breakdown.colResult")}</span>
            <span className="text-right">{t("breakdown.colWin")}</span>
            <span className="text-right">{t("breakdown.colLoss")}</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.key}
              className="grid grid-cols-5 gap-2 font-mono text-xs py-1.5 items-center border-b border-border-soft"
            >
              <span className="text-ink font-body truncate">{r.label}</span>
              <span className="text-right text-muted">{r.n}</span>
              <span
                className={clsx("text-right", r.resultaatTotal > 0 ? "text-win" : r.resultaatTotal < 0 ? "text-loss" : "text-be")}
              >
                {formatAggregate(r.resultaatTotal, resultUnit)}
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
