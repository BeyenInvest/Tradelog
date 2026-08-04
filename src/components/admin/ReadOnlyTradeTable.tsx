import type { Trade } from "@/lib/types";

/**
 * Deliberately not TradeList/TradeListItem — those wire straight into
 * edit/delete handlers meant for the owning user's own trades. This is a
 * plain display table with zero mutation affordances, for the admin debug
 * view of another user's data.
 */
export function ReadOnlyTradeTable({ trades, onRowClick }: { trades: Trade[]; onRowClick?: (trade: Trade) => void }) {
  if (trades.length === 0) return <p className="font-body text-sm text-muted">Geen trades.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-mono text-xs">
        <thead>
          <tr className="text-muted uppercase tracking-wider border-b border-border">
            <th className="py-2 pr-4">Datum</th>
            <th className="py-2 pr-4">Fase</th>
            <th className="py-2 pr-4">Pair</th>
            <th className="py-2 pr-4">Outcome</th>
            <th className="py-2 pr-4">Resultaat</th>
            <th className="py-2 pr-4">Evaluatie</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr
              key={t.id}
              onClick={() => onRowClick?.(t)}
              className={`border-b border-border/50 ${onRowClick ? "cursor-pointer hover:bg-ink/5" : ""}`}
            >
              <td className="py-2 pr-4 text-ink">
                {new Date(t.datum_open + "T00:00:00").toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
              </td>
              <td className="py-2 pr-4 text-muted">{t.fase}</td>
              <td className="py-2 pr-4 text-ink">{t.pair}</td>
              <td className="py-2 pr-4 text-muted">{t.outcome}</td>
              <td className={`py-2 pr-4 ${t.resultaat_pct >= 0 ? "text-win" : "text-loss"}`}>
                {t.resultaat_pct > 0 ? "+" : ""}
                {t.resultaat_pct}%
              </td>
              <td className="py-2 pr-4 text-muted">{t.trade_evaluation ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
