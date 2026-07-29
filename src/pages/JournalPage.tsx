import { useMemo, useState } from "react";
import { TradeJournalView } from "@/components/trades/TradeJournalView";
import { BacktestingAnalysisView } from "@/components/backtesting/BacktestingAnalysisView";
import { useTrades } from "@/hooks/useTrades";

/** Live market trades only — backtest project trades never appear here. */
export default function JournalPage() {
  const [tab, setTab] = useState<"journal" | "analyse">("journal");
  // One shared instance for both tabs — see TradesApi. Two would leave Analyse stale after adding a trade.
  const tradesApi = useTrades({ type: "live" });
  // Missed trades are hypothetical — never counted in the Analyse breakdowns, same rule as the Journal's own KPIs.
  const realTrades = useMemo(
    () => tradesApi.trades.filter((t) => t.trade_evaluation !== "Missed trade"),
    [tradesApi.trades]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex rounded-lg border border-border overflow-hidden w-fit">
        <button
          onClick={() => setTab("journal")}
          className={`px-4 py-2 text-sm font-body ${tab === "journal" ? "bg-gold text-bg" : "bg-surface-2 text-muted"}`}
        >
          Journal
        </button>
        <button
          onClick={() => setTab("analyse")}
          className={`px-4 py-2 text-sm font-body ${tab === "analyse" ? "bg-gold text-bg" : "bg-surface-2 text-muted"}`}
        >
          Analyse
        </button>
      </div>

      {tab === "journal" ? (
        <TradeJournalView scope={{ type: "live" }} tradesApi={tradesApi} title="Journal" recentOnly />
      ) : (
        <BacktestingAnalysisView trades={realTrades} />
      )}
    </div>
  );
}
