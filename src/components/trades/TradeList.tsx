import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { groupTrades, matchesSearch, type GroupBy } from "@/lib/tradeGrouping";
import { dateLocale, formatResult, groupResultCtx, resultDisplayValue, resultInUnit } from "@/lib/format";
import { useResultDisplay } from "@/hooks/useResultDisplay";
import { useMethodology } from "@/hooks/useMethodology";
import type { Trade } from "@/lib/types";
import { TradeListItem } from "./TradeListItem";
import { TradeListHeader } from "./TradeListHeader";

/** Sort key for "sort by result": the trade's value in the active unit; still-running / unresolved trades sort last (null). */
function resultSortKey(t: Trade, unit: Parameters<typeof resultInUnit>[1], saldo: number | null): number | null {
  if (t.is_open || t.resultaat_pct == null) return null;
  return resultInUnit({ resultaat_pct: t.resultaat_pct, risk_pct: t.risk_pct }, unit, saldo);
}

interface TradeListProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
  title?: string;
  /** When `trades` is empty only because active period/filters exclude everything (not because there's truly no history yet), show a reset affordance instead of "Nog geen trades." */
  filtersActive?: boolean;
  onResetFilters?: () => void;
  /** Locks grouping to this value and hides the Week/Maand toggle — used by the dedicated backtest-sessie view, where only one grouping makes sense. */
  fixedGroupBy?: GroupBy;
}

/** Full trade history, grouped by month or ISO week (collapsible) with a free-text search — this is a deliberate full view, not a capped preview. */
export function TradeList({
  trades,
  onEdit,
  onDelete,
  title = "Trades",
  filtersActive = false,
  onResetFilters,
  fixedGroupBy,
}: TradeListProps) {
  const { t, i18n } = useTranslation();
  const { unit: resultUnit, saldo } = useResultDisplay();
  const { isLegacyMethodology } = useMethodology();
  // A modern (own/preset) journal never fills the Weekly Phase Method Concept/Entry
  // columns — swap them for the universal Richting/R columns so they aren't dead space.
  const columnMode = isLegacyMethodology ? "legacy" : "modern";
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>(fixedGroupBy ?? "week");
  const [sortBy, setSortBy] = useState<"date" | "result">("date");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const field = groupBy === "backtestDag" ? "created_at" : "datum_open";
    return [...trades].sort((a, b) => b[field].localeCompare(a[field]));
  }, [trades, groupBy]);
  const filtered = useMemo(() => sorted.filter((t) => matchesSearch(t, search)), [sorted, search]);
  const groups = useMemo(() => groupTrades(filtered, groupBy, dateLocale(i18n.language)), [filtered, groupBy, i18n.language]);

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
          <span className="font-mono text-xs text-muted">{t("journal.tradesCount", { count: sorted.length })}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("list.searchPlaceholder")}
              className="input pl-8 text-xs py-1.5 w-52"
            />
          </div>
          {/* Sort within each group: chronological (default) or by result size. */}
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setSortBy("date")}
              className={`px-3 py-1.5 text-xs font-body transition-colors ${
                sortBy === "date" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {t("list.sortDate")}
            </button>
            <button
              type="button"
              onClick={() => setSortBy("result")}
              className={`px-3 py-1.5 text-xs font-body transition-colors ${
                sortBy === "result" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {t("list.sortResult")}
            </button>
          </div>
          {!fixedGroupBy && (
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setGroupBy("week")}
                className={`px-3 py-1.5 text-xs font-body transition-colors ${
                  groupBy === "week" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                }`}
              >
                {t("list.groupWeek")}
              </button>
              <button
                type="button"
                onClick={() => setGroupBy("month")}
                className={`px-3 py-1.5 text-xs font-body transition-colors ${
                  groupBy === "month" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                }`}
              >
                {t("list.groupMonth")}
              </button>
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted py-4">
          {search ? (
            t("list.noSearchResults", { query: search })
          ) : filtersActive ? (
            <>
              {t("list.noForFilters")}{" "}
              {onResetFilters && (
                <button type="button" onClick={onResetFilters} className="text-gold hover:underline">
                  {t("list.clearFilters")}
                </button>
              )}
            </>
          ) : (
            t("list.noTrades")
          )}
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="flex flex-col min-w-[720px] gap-2.5">
          {groups.map((g) => {
            // While actively searching, every visible group already only contains matches (matchesSearch
            // runs before grouping) — force it open rather than leaving a stale collapse from before the
            // search started, which used to hide real matches with no indication they existed.
            const isCollapsed = search ? false : collapsed.has(g.key);
            const groupCtx = groupResultCtx(g.trades, g.resultaatTotal, resultUnit, saldo);
            const groupTotal = resultDisplayValue(g.resultaatTotal, resultUnit, groupCtx);
            // Sort within the group by result size when asked; unresolved (open) trades
            // sink to the bottom. Default keeps the incoming chronological order.
            const rows =
              sortBy === "result"
                ? [...g.trades].sort((a, b) => {
                    const ka = resultSortKey(a, resultUnit, saldo);
                    const kb = resultSortKey(b, resultUnit, saldo);
                    if (ka == null) return kb == null ? 0 : 1;
                    if (kb == null) return -1;
                    return kb - ka;
                  })
                : g.trades;
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
                    <span className="font-mono text-[11px] text-muted normal-case">· {t("journal.tradesCount", { count: g.trades.length })}</span>
                  </span>
                  <span
                    className={`font-mono text-xs ${
                      groupTotal > 0 ? "text-win" : groupTotal < 0 ? "text-loss" : "text-be"
                    }`}
                  >
                    {formatResult(g.resultaatTotal, resultUnit, groupCtx)}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="px-3 pb-1 pt-2">
                    <TradeListHeader columnMode={columnMode} />
                    {rows.map((t) => (
                      <TradeListItem key={t.id} trade={t} onEdit={onEdit} onDelete={onDelete} columnMode={columnMode} />
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
