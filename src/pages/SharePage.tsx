import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { FullScreenLoading } from "@/components/ui/FullScreenLoading";
import { WinRatePieChart } from "@/components/charts/WinRatePieChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { ReadOnlyTradesViewer } from "@/components/admin/ReadOnlyTradesViewer";
import { ResultDisplayProvider } from "@/hooks/useResultDisplay";
import { getSharedJournal } from "@/lib/share/shareLinks";
import { computeOverviewKpis, takenTrades } from "@/lib/stats";
import { formatProfitFactor, formatResult, resultDisplayValue } from "@/lib/format";
import type { ResultUnit } from "@/lib/constants";
import type { SharedJournal } from "@/lib/types";

/**
 * Public read-only journal view behind a share-link token (Fase M) — the page a
 * coach opens without an account. Everything comes from one anonymous RPC call
 * (get_shared_journal, migration 0040); an invalid/revoked/expired token gets a
 * single generic message, deliberately without saying which of the three it was.
 *
 * No edit affordances, no auth-only calls: the KPI row/charts are computed
 * client-side from the returned trades via src/lib/stats. The RPC already ships
 * a strict payload (allow-listed columns, no missed trades, storage-path
 * screenshots blanked) — the takenTrades() call below is the conventional
 * second line of defence, not the enforcement point.
 */
export default function SharePage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedJournal | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Share URLs are unlisted capabilities — keep search engines from indexing one
  // that ends up linked somewhere public. SPA, so the tag is set per-route here.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    // Reset before fetching: on a token change the previous journal (or a stale
    // failure) must never linger under the new URL.
    setData(null);
    setFailed(false);
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSharedJournal(token)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) return <FullScreenLoading />;

  if (!data) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body px-4">
        <div className="w-full max-w-md rounded-xl p-8 bg-surface border border-border text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <LogoMark size={30} className="text-gold" />
            <span className="font-display text-3xl italic text-ink"><Wordmark /></span>
          </div>
          <h1 className="font-display text-xl italic text-ink mb-2">
            {failed ? t("share.loadFailedTitle") : t("share.invalidTitle")}
          </h1>
          <p className="text-sm text-muted">{failed ? t("share.loadFailedBody") : t("share.invalidBody")}</p>
        </div>
      </div>
    );
  }

  return <SharedJournalView data={data} />;
}

function SharedJournalView({ data }: { data: SharedJournal }) {
  const { t } = useTranslation();
  // Honour the owner's display unit for % and R; currency needs an account
  // saldo an anonymous session doesn't have, so it falls back to honest %.
  const unit: ResultUnit = data.result_unit === "currency" ? "percent" : data.result_unit;
  // Missed trades are hypothetical — the share view shows real performance only.
  // (The RPC already excludes them; see the header comment.)
  const trades = useMemo(() => takenTrades(data.trades), [data.trades]);
  const kpis = useMemo(() => computeOverviewKpis(trades), [trades]);

  return (
    <ResultDisplayProvider override={{ unit, saldo: null }}>
      <div className="min-h-screen w-full bg-bg font-body">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <LogoMark size={26} className="text-gold" />
              <span className="font-display text-2xl italic text-ink"><Wordmark /></span>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-2 font-body text-xs text-muted">
              <Lock size={13} /> {t("share.readOnlyBadge")}
            </span>
          </div>

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
            <StatCard
              label={t("journal.statResult")}
              value={formatResult(kpis.totalResultaat, unit, { rMultiple: kpis.totalR })}
              tone={resultDisplayValue(kpis.totalResultaat, unit, { rMultiple: kpis.totalR }) >= 0 ? "up" : "down"}
            />
            <StatCard
              label={t("journal.statProfitFactor")}
              value={formatProfitFactor(kpis.profitFactor)}
              tone={kpis.profitFactor == null ? "neutral" : kpis.profitFactor >= 1 ? "up" : "down"}
            />
            <StatCard
              label={t("journal.statAvgR")}
              value={kpis.avgR != null ? `${kpis.avgR > 0 ? "+" : ""}${kpis.avgR.toFixed(2)}R` : "—"}
              tone={kpis.avgR != null ? (kpis.avgR >= 0 ? "up" : "down") : "neutral"}
              sub={kpis.avgR != null ? t("journal.statTotalR", { total: kpis.totalR.toFixed(2) }) : undefined}
            />
            <StatCard
              label={t("journal.statMaxDrawdown")}
              value={`${kpis.maxDrawdownPct > 0 ? "-" : ""}${kpis.maxDrawdownPct}%`}
              tone={kpis.maxDrawdownPct > 0 ? "down" : "neutral"}
            />
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

          <ReadOnlyTradesViewer trades={trades} title={t("journal.trades")} hideFase={data.hide_fase} />

          <p className="text-center font-body text-xs text-faint pt-4 pb-2">
            {t("share.poweredByPrefix")}{" "}
            <Link to="/" className="text-muted hover:text-gold underline-offset-2 hover:underline">
              Beyen Invest
            </Link>
          </p>
        </div>
      </div>
    </ResultDisplayProvider>
  );
}
