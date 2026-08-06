import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TradeJournalView } from "@/components/trades/TradeJournalView";
import { BacktestingAnalysisView } from "@/components/backtesting/BacktestingAnalysisView";
import { useTrades } from "@/hooks/useTrades";
import { takenTrades } from "@/lib/stats";

/** Live market trades only — backtest project trades never appear here. */
export default function JournalPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"journal" | "analyse">("journal");
  // One shared instance for both tabs — see TradesApi. Two would leave Analyse stale after adding a trade.
  const tradesApi = useTrades({ type: "live" });
  // Missed trades are hypothetical — never counted in the Analyse breakdowns, same rule as the Journal's own KPIs.
  const realTrades = useMemo(() => takenTrades(tradesApi.trades), [tradesApi.trades]);

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex rounded-lg border border-border overflow-hidden w-fit">
        <button
          onClick={() => setTab("journal")}
          className={`px-4 py-2 text-sm font-body ${tab === "journal" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
        >
          {t("journal.tabJournal")}
        </button>
        <button
          onClick={() => setTab("analyse")}
          className={`px-4 py-2 text-sm font-body ${tab === "analyse" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
        >
          {t("journal.tabAnalyse")}
        </button>
      </div>

      {tab === "journal" ? (
        <TradeJournalView scope={{ type: "live" }} tradesApi={tradesApi} title={t("journal.title")} />
      ) : (
        <BacktestingAnalysisView trades={realTrades} />
      )}
    </div>
  );
}
