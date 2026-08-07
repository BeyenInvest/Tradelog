import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Trade } from "@/lib/types";
import { groupTrades, groupTradesByOutcome, type TradeGroup } from "@/lib/tradeGrouping";
import { sortChronological } from "@/lib/stats";
import type { PeriodType } from "@/lib/constants";
import { TradeListItem } from "@/components/trades/TradeListItem";
import { TradeListHeader } from "@/components/trades/TradeListHeader";

export type GroupMode = "outcome" | "week" | "month" | "quarter";

const MODE_LABEL_KEYS: Record<GroupMode, string> = {
  outcome: "reviews.modeOutcome",
  week: "reviews.modeWeek",
  month: "reviews.modeMonth",
  quarter: "reviews.modeQuarter",
};

/** Most-recent-first, via the same datum_open+id tie-break as everywhere else that sorts chronologically. */
function sortDesc(trades: Trade[]): Trade[] {
  return sortChronological(trades).reverse();
}

function TradeGroupList({ groups, defaultOpenKey }: { groups: TradeGroup[]; defaultOpenKey: string | null }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.key).filter((k) => k !== defaultOpenKey))
  );

  useLayoutEffect(() => {
    setCollapsed(new Set(groups.map((g) => g.key).filter((k) => k !== defaultOpenKey)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpenKey]);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.key);
        return (
          <div key={g.key} className="rounded-lg border border-border-soft overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="w-full flex items-center justify-between px-3 py-2 bg-surface-2 text-left"
            >
              <span className="flex items-center gap-2 font-body text-sm text-ink">
                {isCollapsed ? (
                  <ChevronRight size={14} className="text-muted" />
                ) : (
                  <ChevronDown size={14} className="text-muted" />
                )}
                {g.label}
                <span className="font-mono text-[11px] text-muted">· {t("journal.tradesCount", { count: g.trades.length })}</span>
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
            {!isCollapsed &&
              (g.trades.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted">{t("reviews.noTradesShort")}</p>
              ) : (
                <div className="px-3 pb-1 pt-2 overflow-x-auto">
                  <div className="min-w-[640px]">
                    <TradeListHeader />
                    {g.trades.map((t) => (
                      <TradeListItem key={t.id} trade={t} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function ReviewTradeSection({
  label,
  trades,
  emptyLabel,
  groupMode,
}: {
  label: string;
  trades: Trade[];
  emptyLabel: string;
  groupMode: GroupMode;
}) {
  const groups = useMemo(() => {
    const sorted = sortDesc(trades);
    return groupMode === "outcome" ? groupTradesByOutcome(sorted) : groupTrades(sorted, groupMode);
  }, [trades, groupMode]);

  const defaultOpenKey = groupMode === "outcome" ? "Win" : (groups[0]?.key ?? null);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-ink/60" />
        <h4 className="font-body text-sm font-semibold text-ink">{label}</h4>
        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-full bg-ink/10 text-muted">{trades.length}</span>
      </div>
      {trades.length === 0 ? (
        <p className="text-xs text-muted">{emptyLabel}</p>
      ) : (
        <TradeGroupList groups={groups} defaultOpenKey={defaultOpenKey} />
      )}
    </div>
  );
}

/** Sub-period breakdowns worth offering per periodic review type — a month's trades are usefully split by week, a quarter's by week or month, a year's by month or quarter (a year has too many weeks to be useful). */
export function periodicExtraGroupModes(periodType: PeriodType): GroupMode[] {
  if (periodType === "month") return ["week"];
  if (periodType === "quarter") return ["week", "month"];
  return ["month", "quarter"];
}

interface ReviewTradeGroupsProps {
  taken: Trade[];
  missed: Trade[];
  /** Extra grouping modes beyond the default Win/BE/Loss, in display order — e.g. ["week"] for a monthly review, ["month", "quarter"] for a yearly one. Weekly reviews pass none. */
  extraGroupModes?: GroupMode[];
}

/** Collapsible Win/BE/Loss (or, for periodic reviews, per-week/month/quarter) trade groups for a review — read-only, replaces the old flat TradeRows. */
export function ReviewTradeGroups({ taken, missed, extraGroupModes = [] }: ReviewTradeGroupsProps) {
  const { t } = useTranslation();
  const modes: GroupMode[] = ["outcome", ...extraGroupModes];
  const [groupMode, setGroupMode] = useState<GroupMode>("outcome");

  return (
    <div className="flex flex-col gap-4">
      {modes.length > 1 && (
        <div className="inline-flex rounded-lg border border-border overflow-hidden self-start">
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGroupMode(mode)}
              className={`px-3 py-1.5 text-xs font-body transition-colors ${
                groupMode === mode ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {t(MODE_LABEL_KEYS[mode])}
            </button>
          ))}
        </div>
      )}

      <ReviewTradeSection label={t("reviews.tradesTaken")} trades={taken} emptyLabel={t("reviews.noTakenTrades")} groupMode={groupMode} />
      {missed.length > 0 && (
        <ReviewTradeSection label={t("reviews.missedTradesLabel")} trades={missed} emptyLabel={t("reviews.noMissedTrades")} groupMode={groupMode} />
      )}
    </div>
  );
}
