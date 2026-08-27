import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TradeJournalView } from "@/components/trades/TradeJournalView";
import { BacktestingAnalysisView } from "@/components/backtesting/BacktestingAnalysisView";
import { useTrades } from "@/hooks/useTrades";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import { takenTrades } from "@/lib/stats";

/** Live market trades only — backtest project trades never appear here. */
export default function JournalPage() {
  const { t } = useTranslation();
  const { profile, betaFeatures } = useAuth();
  const { fields, loading: methLoading } = useMethodology();
  const [tab, setTab] = useState<"journal" | "analyse">("journal");
  // Remount the views on a journal switch so local view state (filters, period, view
  // mode) resets to a fresh view of the new book — otherwise a filter carried from a
  // forex journal (e.g. a pair) would invisibly filter a non-forex journal (cyclus 3b/7).
  const journalKey = profile?.methodology_id ?? "none";
  // One shared instance for both tabs — see TradesApi. Two would leave Analyse stale after adding a trade.
  const tradesApi = useTrades({ type: "live" });
  // Missed trades are hypothetical — never counted in the Analyse breakdowns, same rule as the Journal's own KPIs.
  const realTrades = useMemo(() => takenTrades(tradesApi.trades), [tradesApi.trades]);

  // First-run empty-state config (fase C). Treat the journal as "configured" while
  // the methodology is still loading so we never flash the big preset picker before
  // we know the field count. The picker itself is beta-gated, matching Settings.
  const onboarding = useMemo(
    () => ({ hasFields: methLoading || fields.length > 0, showPresetPicker: betaFeatures }),
    [methLoading, fields.length, betaFeatures]
  );

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
        <TradeJournalView
          key={journalKey}
          scope={{ type: "live" }}
          tradesApi={tradesApi}
          title={t("journal.title")}
          // Soft-launch: the Fase-C onboarding empty-state (preset picker) ships to
          // owner/beta accounts only; live users keep the pre-launch behaviour.
          onboarding={betaFeatures ? onboarding : undefined}
        />
      ) : (
        <BacktestingAnalysisView key={journalKey} trades={realTrades} showAdherence />
      )}
    </div>
  );
}
