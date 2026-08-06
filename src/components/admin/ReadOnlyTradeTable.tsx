import { useTranslation } from "react-i18next";
import { dateLocale } from "@/lib/format";
import type { Trade } from "@/lib/types";

/**
 * Deliberately not TradeList/TradeListItem — those wire straight into
 * edit/delete handlers meant for the owning user's own trades. This is a
 * plain display table with zero mutation affordances, for the admin debug
 * view of another user's data.
 */
export function ReadOnlyTradeTable({ trades, onRowClick }: { trades: Trade[]; onRowClick?: (trade: Trade) => void }) {
  const { t, i18n } = useTranslation();
  if (trades.length === 0) return <p className="font-body text-sm text-muted">{t("reviews.noTradesShort")}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-mono text-xs">
        <thead>
          <tr className="text-muted uppercase tracking-wider border-b border-border">
            <th className="py-2 pr-4">{t("list.colDate")}</th>
            <th className="py-2 pr-4">{t("list.colFase")}</th>
            <th className="py-2 pr-4">{t("list.colPair")}</th>
            <th className="py-2 pr-4">{t("list.colOutcome")}</th>
            <th className="py-2 pr-4">{t("list.colResult")}</th>
            <th className="py-2 pr-4">{t("filters.evaluation")}</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((tr) => (
            <tr
              key={tr.id}
              onClick={() => onRowClick?.(tr)}
              className={`border-b border-border/50 ${onRowClick ? "cursor-pointer hover:bg-ink/5" : ""}`}
            >
              <td className="py-2 pr-4 text-ink">
                {new Date(tr.datum_open + "T00:00:00").toLocaleDateString(dateLocale(i18n.language), { day: "2-digit", month: "2-digit", year: "2-digit" })}
              </td>
              <td className="py-2 pr-4 text-muted">{tr.fase}</td>
              <td className="py-2 pr-4 text-ink">{tr.pair}</td>
              <td className="py-2 pr-4 text-muted">{tr.outcome}</td>
              <td className={`py-2 pr-4 ${tr.resultaat_pct >= 0 ? "text-win" : "text-loss"}`}>
                {tr.resultaat_pct > 0 ? "+" : ""}
                {tr.resultaat_pct}%
              </td>
              <td className="py-2 pr-4 text-muted">{tr.trade_evaluation ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
