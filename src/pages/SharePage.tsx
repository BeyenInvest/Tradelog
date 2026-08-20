import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { FullScreenLoading } from "@/components/ui/FullScreenLoading";
import { WinRatePieChart } from "@/components/charts/WinRatePieChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { ReadOnlyTradesViewer } from "@/components/admin/ReadOnlyTradesViewer";
import { SharePageShell, ShareInvalidState } from "@/components/share/SharePageShell";
import { AvgRStatCard, MaxDrawdownStatCard, ProfitFactorStatCard, ResultStatCard } from "@/components/trades/JournalKpiCards";
import { ResultDisplayProvider } from "@/hooks/useResultDisplay";
import { useNoIndexMeta } from "@/hooks/useNoIndexMeta";
import { useSharedToken } from "@/hooks/useSharedToken";
import { getSharedJournal } from "@/lib/share/shareLinks";
import { computeOverviewKpis, takenTrades, closedTrades } from "@/lib/stats";
import type { ResultUnit } from "@/lib/constants";
import type { SharedJournal } from "@/lib/types";

/**
 * Public read-only journal view behind a share-link token (Fase M) — the page a
 * coach opens without an account. Everything comes from one anonymous RPC call
 * (get_shared_journal, migration 0040/0042); an invalid/revoked/expired token
 * gets a single generic message, deliberately without saying which of the three
 * it was.
 *
 * No edit affordances, no auth-only calls: the KPI row/charts are computed
 * client-side from the returned trades via src/lib/stats. The RPC already ships
 * a strict payload (allow-listed columns, no missed trades, storage-path
 * screenshots blanked) — the takenTrades() call below is the conventional
 * second line of defence, not the enforcement point.
 */
export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const { data, loading, failed } = useSharedToken(token, getSharedJournal);

  useNoIndexMeta();

  if (loading) return <FullScreenLoading />;
  if (!data) return <ShareInvalidState failed={failed} />;
  return <SharedJournalView data={data} />;
}

function SharedJournalView({ data }: { data: SharedJournal }) {
  const { t } = useTranslation();
  // Honour the owner's display unit for % and R; currency needs an account
  // saldo an anonymous session doesn't have, so it falls back to honest %.
  const unit: ResultUnit = data.result_unit === "currency" ? "percent" : data.result_unit;
  // Missed trades are hypothetical and still-running open trades have no result yet —
  // the share view shows real performance only. (The RPC already excludes both; this
  // mirror-filter also narrows the type to the realized ClosedTrade shape.)
  const trades = useMemo(() => closedTrades(takenTrades(data.trades)), [data.trades]);
  const kpis = useMemo(() => computeOverviewKpis(trades), [trades]);

  return (
    <ResultDisplayProvider override={{ unit, saldo: null }}>
      <SharePageShell maxWidthClass="max-w-6xl">
        <div>
          <h1 className="font-display text-3xl italic text-ink">
            {data.journal_name ?? t("share.journalFallback")}
          </h1>
          <p className="font-body text-sm text-muted mt-1">
            {data.display_name
              ? t("share.sharedBy", { name: data.display_name })
              : t("share.sharedAnonymous")}{" "}
            · {t("journal.tradesCount", { count: trades.length })}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label={t("journal.statTotalTrades")} value={kpis.totalTrades} />
          <ResultStatCard kpis={kpis} unit={unit} />
          <ProfitFactorStatCard kpis={kpis} />
          <AvgRStatCard kpis={kpis} />
          <MaxDrawdownStatCard kpis={kpis} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="flex flex-col items-center justify-center">
            <h3 className="font-display text-xl italic mb-2 self-start text-ink">{t("journal.winRate")}</h3>
            <WinRatePieChart wins={kpis.wins} be={kpis.be} losses={kpis.losses} />
            <div className="flex gap-4 mt-3 font-mono text-xs">
              <span className="text-win">{kpis.wins}W</span>
              <span className="text-be">{kpis.be}BE</span>
              <span className="text-loss">{kpis.losses}L</span>
            </div>
            {kpis.winRateExclBe != null && (
              <p className="mt-2 font-mono text-[11px] text-muted">
                {t("journal.winRateExclBe", { pct: (kpis.winRateExclBe * 100).toFixed(0) })}
              </p>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <h3 className="font-display text-xl italic mb-4 text-ink">{t("journal.cumulativeResult")}</h3>
            <EquityCurveChart trades={trades} />
          </Card>
        </div>

        <ReadOnlyTradesViewer trades={trades} title={t("journal.trades")} hideFase={data.hide_fase} fields={data.fields} />
      </SharePageShell>
    </ResultDisplayProvider>
  );
}
