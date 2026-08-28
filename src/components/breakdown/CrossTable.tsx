import { useMemo, useState } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import { computeCrossTable, getCell, type ClosedTrade, type CrossTableCell } from "@/lib/stats";
import { formatAggregate } from "@/lib/format";
import { useResultUnit } from "@/hooks/useResultUnit";
import type { Trade } from "@/lib/types";

/** A dimension the cross-table can pivot on — a thin, i18n-resolved slice of DimensionConfig. */
export interface CrossDim {
  id: string;
  /** Already-translated dimension title (e.g. "Per Sessie"). */
  title: string;
  keyFn: (t: Trade) => string | string[] | null;
  sortOrder?: readonly string[];
  /** Already-bound row-key → label translator (weekday abbreviations, Yes/No, …). */
  labelFn?: (key: string) => string;
}

type Metric = "resultaat" | "winRate" | "trades";

interface CrossTableProps {
  /** Must already be in the active result unit (caller: tradesInResultUnit) — only the resultaat metric is formatted here. */
  trades: ClosedTrade[];
  dims: CrossDim[];
}

/** Whether any trade yields a (non-null, non-empty) key for this dimension — i.e. the dimension would produce at least one row/column rather than an empty axis. */
function dimHasData(dim: CrossDim, trades: ClosedTrade[]): boolean {
  return trades.some((t) => {
    const k = dim.keyFn(t);
    return Array.isArray(k) ? k.length > 0 : k != null;
  });
}

/** Sign-based tone for a cell, per the active metric. */
function toneClass(cell: CrossTableCell, metric: Metric): string {
  if (metric === "resultaat") return cell.resultaatTotal > 0 ? "text-win" : cell.resultaatTotal < 0 ? "text-loss" : "text-be";
  if (metric === "winRate") return cell.winRate > 0.5 ? "text-win" : cell.winRate < 0.5 ? "text-loss" : "text-be";
  return "text-ink";
}

/**
 * Kruistabel (Fase S2): any two "Per X" dimensions cross-tabulated into a matrix,
 * driven entirely by the shared DimensionConfig list (passed in as CrossDim[]) and
 * computeCrossTable — no dimension logic here, just the picker + rendering. Row/col
 * dimensions and the shown metric (resultaat / win% / trades) are user-selectable;
 * cells and totals reuse the exact keyFn contract of every other breakdown.
 */
export function CrossTable({ trades, dims }: CrossTableProps) {
  const { t } = useTranslation();
  const resultUnit = useResultUnit();

  // Row/col start unset ("") = "auto": use the data-aware defaults below. An explicit
  // pick (even one that's empty) is honoured. Empty string never matches a dim id.
  const [rowId, setRowId] = useState<string>("");
  const [colId, setColId] = useState<string>("");
  const [metric, setMetric] = useState<Metric>("resultaat");

  // Auto defaults land on dimensions that actually have data, so the flagship
  // kruistabel never opens empty (UX-C) — the old default preferred a timing axis
  // (sessie/uur) even for journals with no tijd_open, giving a blank table.
  const autoRowDim = useMemo(() => dims.find((d) => dimHasData(d, trades)) ?? dims[0], [dims, trades]);
  const autoColDim = useMemo(() => {
    // Prefer a timing axis for the columns, but only when it has data.
    const timing = dims.find((d) => (d.id === "sessie" || d.id === "uur") && dimHasData(d, trades));
    if (timing) return timing;
    // Else the first other data-bearing dimension; fall back to any second dim.
    const other = dims.find((d) => d.id !== autoRowDim?.id && dimHasData(d, trades));
    return other ?? dims.find((d) => d.id !== autoRowDim?.id) ?? dims[1] ?? dims[0];
  }, [dims, trades, autoRowDim]);

  // An explicit selection wins; otherwise the data-aware auto default. This also
  // recovers when a previously-selected dimension disappears (journal switch).
  const rowDim = dims.find((d) => d.id === rowId) ?? autoRowDim;
  const colDim = dims.find((d) => d.id === colId) ?? autoColDim;

  const table = useMemo(
    () =>
      rowDim && colDim
        ? computeCrossTable(trades, rowDim.keyFn, colDim.keyFn, { rowOrder: rowDim.sortOrder, colOrder: colDim.sortOrder })
        : null,
    [trades, rowDim, colDim]
  );

  if (dims.length < 2 || !rowDim || !colDim) return null;

  const rowLabel = (k: string) => (rowDim.labelFn ? rowDim.labelFn(k) : k);
  const colLabel = (k: string) => (colDim.labelFn ? colDim.labelFn(k) : k);

  const renderMetric = (cell: CrossTableCell) => {
    if (metric === "resultaat") return formatAggregate(cell.resultaatTotal, resultUnit);
    if (metric === "winRate") return `${(cell.winRate * 100).toFixed(0)}%`;
    return String(cell.n);
  };

  const selectClass =
    "rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 font-body text-xs text-ink focus:outline-none focus:ring-1 focus:ring-gold";

  const hasData = table != null && table.rowKeys.length > 0 && table.colKeys.length > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className={selectClass} value={rowDim.id} onChange={(e) => setRowId(e.target.value)} aria-label={t("crossTable.rowDimension")}>
          {dims.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <span className="font-body text-xs text-muted">×</span>
        <select className={selectClass} value={colDim.id} onChange={(e) => setColId(e.target.value)} aria-label={t("crossTable.colDimension")}>
          {dims.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <div className="ml-auto inline-flex rounded-lg border border-border overflow-hidden">
          {(["resultaat", "winRate", "trades"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={clsx("px-2.5 py-1.5 text-xs font-body", metric === m ? "bg-gold text-on-gold" : "bg-surface-2 text-muted")}
            >
              {t(`crossTable.metric_${m}`)}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="text-sm text-muted">{t("crossTable.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="font-body text-[10px] uppercase tracking-wide text-muted">
                <th className="text-left font-normal pb-1.5 pr-3 border-b border-border sticky left-0 bg-surface">
                  {rowDim.title} \ {colDim.title}
                </th>
                {table.colKeys.map((ck) => (
                  <th key={ck} className="text-right font-normal pb-1.5 px-2 border-b border-border whitespace-nowrap">
                    {colLabel(ck)}
                  </th>
                ))}
                <th className="text-right font-semibold pb-1.5 pl-2 border-b border-border whitespace-nowrap text-ink">
                  {t("crossTable.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {table.rowKeys.map((rk) => {
                const rowTotal = table.rowTotals.get(rk);
                return (
                  <tr key={rk} className="border-b border-border-soft">
                    <th className="text-left font-body text-ink font-normal py-1.5 pr-3 whitespace-nowrap sticky left-0 bg-surface truncate max-w-[160px]">
                      {rowLabel(rk)}
                    </th>
                    {table.colKeys.map((ck) => {
                      const cell = getCell(table, rk, ck);
                      if (!cell) return <td key={ck} className="text-right px-2 py-1.5 text-muted">·</td>;
                      return (
                        <td key={ck} className={clsx("text-right px-2 py-1.5", cell.isLowSample && "opacity-60")}>
                          <span className={toneClass(cell, metric)}>{renderMetric(cell)}</span>
                          {metric !== "trades" && <span className="text-[10px] text-muted ml-1">{cell.n}</span>}
                        </td>
                      );
                    })}
                    {rowTotal && (
                      <td className="text-right pl-2 py-1.5 font-semibold">
                        <span className={toneClass(rowTotal, metric)}>{renderMetric(rowTotal)}</span>
                        {metric !== "trades" && <span className="text-[10px] text-muted ml-1">{rowTotal.n}</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
              <tr className="border-t border-border">
                <th className="text-left font-body font-semibold text-ink py-1.5 pr-3 sticky left-0 bg-surface">{t("crossTable.total")}</th>
                {table.colKeys.map((ck) => {
                  const colTotal = table.colTotals.get(ck);
                  return (
                    <td key={ck} className="text-right px-2 py-1.5 font-semibold">
                      {colTotal ? (
                        <>
                          <span className={toneClass(colTotal, metric)}>{renderMetric(colTotal)}</span>
                          {metric !== "trades" && <span className="text-[10px] text-muted ml-1">{colTotal.n}</span>}
                        </>
                      ) : (
                        <span className="text-muted">·</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-right pl-2 py-1.5 font-semibold">
                  <span className={toneClass(table.grandTotal, metric)}>{renderMetric(table.grandTotal)}</span>
                  {metric !== "trades" && <span className="text-[10px] text-muted ml-1">{table.grandTotal.n}</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
