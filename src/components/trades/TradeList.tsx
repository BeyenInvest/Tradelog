import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { MONTH_NAMES } from "@/lib/constants";
import type { Trade } from "@/lib/types";
import { TradeListItem } from "./TradeListItem";

interface TradeListProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
  title?: string;
  limit?: number;
}

interface MonthGroup {
  key: string;
  label: string;
  trades: Trade[];
  resultaatTotal: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Trades are already sorted desc by datum_open — grouping preserves that order, newest month first. */
function groupByMonth(trades: Trade[]): MonthGroup[] {
  const map = new Map<string, Trade[]>();
  const order: string[] = [];
  for (const t of trades) {
    const key = t.datum_open.slice(0, 7); // yyyy-mm
    let bucket = map.get(key);
    if (!bucket) {
      bucket = [];
      map.set(key, bucket);
      order.push(key);
    }
    bucket.push(t);
  }
  return order.map((key) => {
    const bucketTrades = map.get(key)!;
    const [y, m] = key.split("-");
    return {
      key,
      label: `${MONTH_NAMES[Number(m) - 1]} ${y}`,
      trades: bucketTrades,
      resultaatTotal: round2(bucketTrades.reduce((s, t) => s + t.resultaat_pct, 0)),
    };
  });
}

function ListHeader() {
  return (
    <div className="grid grid-cols-7 gap-3 font-body text-[11px] uppercase tracking-wide pb-2 mb-1 text-muted border-b border-border">
      <span>Datum</span>
      <span>Pair</span>
      <span>Fase</span>
      <span>Concept</span>
      <span>Outcome</span>
      <span className="text-right">Resultaat</span>
      <span />
    </div>
  );
}

/** Recent-trades mode (limit set, e.g. Journal's dashboard) stays a flat list; the full list groups by month, collapsible. */
export function TradeList({ trades, onEdit, onDelete, title = "Trades", limit }: TradeListProps) {
  const sorted = useMemo(() => [...trades].sort((a, b) => b.datum_open.localeCompare(a.datum_open)), [trades]);
  const limited = useMemo(() => (limit ? sorted.slice(0, limit) : sorted), [sorted, limit]);
  const groups = useMemo(() => (limit ? [] : groupByMonth(limited)), [limited, limit]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl italic text-ink">{title}</h3>
        <span className="font-mono text-xs text-muted">{sorted.length} trades</span>
      </div>

      {limited.length === 0 && <p className="text-sm text-muted py-4">Nog geen trades.</p>}

      {limit ? (
        <div className="overflow-x-auto">
          <div className="flex flex-col min-w-[640px]">
            <ListHeader />
            {limited.map((t) => (
              <TradeListItem key={t.id} trade={t} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex flex-col min-w-[640px] gap-2.5">
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.key);
              return (
                <div key={g.key} className="rounded-lg border border-border-soft overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(g.key)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-surface-2 text-left"
                  >
                    <span className="flex items-center gap-2 font-body text-sm text-ink capitalize">
                      {isCollapsed ? (
                        <ChevronRight size={14} className="text-muted" />
                      ) : (
                        <ChevronDown size={14} className="text-muted" />
                      )}
                      {g.label}
                      <span className="font-mono text-[11px] text-muted normal-case">· {g.trades.length} trades</span>
                    </span>
                    <span
                      className={`font-mono text-xs ${
                        g.resultaatTotal > 0 ? "text-win" : g.resultaatTotal < 0 ? "text-loss" : "text-be"
                      }`}
                    >
                      {g.resultaatTotal > 0 ? "+" : ""}
                      {g.resultaatTotal}%
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="px-3 pb-1 pt-2">
                      <ListHeader />
                      {g.trades.map((t) => (
                        <TradeListItem key={t.id} trade={t} onEdit={onEdit} onDelete={onDelete} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
