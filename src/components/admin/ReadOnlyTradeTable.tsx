import { useTranslation } from "react-i18next";
import { dateLocale, formatResult, resultDisplayValue } from "@/lib/format";
import { hasExplicitRisk, rMultiple } from "@/lib/stats";
import { useResultUnit } from "@/hooks/useResultUnit";
import { columnModeForTrades } from "@/components/trades/TradeListHeader";
import type { Trade } from "@/lib/types";

/**
 * Deliberately not TradeList/TradeListItem — those wire straight into
 * edit/delete handlers meant for the owning user's own trades. This is a
 * plain display table with zero mutation affordances, for the admin debug
 * view of another user's data.
 */
export function ReadOnlyTradeTable({
  trades,
  onRowClick,
  hideFase = false,
}: {
  trades: Trade[];
  onRowClick?: (trade: Trade) => void;
  /** Share view (Fase M): honour the owner's hide_fase setting. */
  hideFase?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const resultUnit = useResultUnit();
  if (trades.length === 0) return <p className="font-body text-sm text-muted">{t("reviews.noTradesShort")}</p>;

  // A modern journal never carries a meaningful fase — drop the column entirely
  // (not just when the owner toggled hide_fase) so no WPM jargon leaks in (UX-A).
  const showFase = !hideFase && columnModeForTrades(trades) === "legacy";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-mono text-xs">
        <thead>
          <tr className="text-muted uppercase tracking-wider border-b border-border">
            <th className="py-2 pr-4">{t("list.colDate")}</th>
            {showFase && <th className="py-2 pr-4">{t("list.colFase")}</th>}
            <th className="py-2 pr-4">{t("list.colPair")}</th>
            <th className="py-2 pr-4">{t("list.colOutcome")}</th>
            <th className="py-2 pr-4">{t("list.colResult")}</th>
            <th className="py-2 pr-4">{t("filters.evaluation")}</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((tr) => {
            // A still-running trade has no realized result yet — show a badge + "—".
            const closed = !tr.is_open;
            const ctx = closed
              ? { rMultiple: rMultiple({ resultaat_pct: tr.resultaat_pct!, risk_pct: tr.risk_pct }), rAssumed: !hasExplicitRisk(tr) }
              : undefined;
            const shown = closed ? resultDisplayValue(tr.resultaat_pct!, resultUnit, ctx) : 0;
            return (
              <tr
                key={tr.id}
                onClick={() => onRowClick?.(tr)}
                className={`border-b border-border/50 ${onRowClick ? "cursor-pointer hover:bg-ink/5" : ""}`}
              >
                <td className="py-2 pr-4 text-ink">
                  {new Date(tr.datum_open + "T00:00:00").toLocaleDateString(dateLocale(i18n.language), { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </td>
                {showFase && <td className="py-2 pr-4 text-muted">{tr.fase}</td>}
                <td className="py-2 pr-4 text-ink">{tr.instrument ?? tr.pair}</td>
                <td className="py-2 pr-4 text-muted">{closed ? tr.outcome : t("tradeBadge.open")}</td>
                <td className={`py-2 pr-4 ${!closed ? "text-faint" : shown >= 0 ? "text-win" : "text-loss"}`}>
                  {closed ? formatResult(tr.resultaat_pct!, resultUnit, ctx) : "—"}
                </td>
                <td className="py-2 pr-4 text-muted">{tr.trade_evaluation ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
