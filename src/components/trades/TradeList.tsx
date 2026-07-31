import { useLayoutEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { groupTrades, matchesSearch, type GroupBy } from "@/lib/tradeGrouping";
import type { Trade } from "@/lib/types";
import { TradeListItem } from "./TradeListItem";

interface TradeListProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
  title?: string;
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

/** Full trade history, grouped by month or ISO week (collapsible) with a free-text search — this is a deliberate full view, not a capped preview. */
export function TradeList({ trades, onEdit, onDelete, title = "Trades" }: TradeListProps) {
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => [...trades].sort((a, b) => b.datum_open.localeCompare(a.datum_open)), [trades]);
  const filtered = useMemo(() => sorted.filter((t) => matchesSearch(t, search)), [sorted, search]);
  const groups = useMemo(() => groupTrades(filtered, groupBy), [filtered, groupBy]);

  // Only the most recent group starts open — with the full history now on one page, collapsing the rest keeps it scannable. Re-applied whenever the grouping granularity changes; individual toggles otherwise persist while searching.
  useLayoutEffect(() => {
    setCollapsed(new Set(groups.slice(1).map((g) => g.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy]);

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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-xl italic text-ink">{title}</h3>
          <span className="font-mono text-xs text-muted">{sorted.length} trades</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek op pair, fase, concept..."
              className="input pl-8 text-xs py-1.5 w-52"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setGroupBy("month")}
              className={`px-3 py-1.5 text-xs font-body transition-colors ${
                groupBy === "month" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              Maand
            </button>
            <button
              type="button"
              onClick={() => setGroupBy("week")}
              className={`px-3 py-1.5 text-xs font-body transition-colors ${
                groupBy === "week" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted py-4">{search ? `Geen trades gevonden voor "${search}".` : "Nog geen trades."}</p>
      )}

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
    </Card>
  );
}
