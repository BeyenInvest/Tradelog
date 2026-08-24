import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/ui/StatCard";
import { formatProfitFactor, formatResult, pctToAmount, resultDisplayValue } from "@/lib/format";
import type { OverviewKpis } from "@/lib/stats";
import type { ResultUnit } from "@/lib/constants";

/**
 * The four journal-KPI StatCards shared by TradeJournalView and SharePage
 * (Fase M-review reuse-finding, toegepast in sessie 2): value/tone/format logic
 * lives once, the rows keep their own layout and extra cards (streaks,
 * perf-window) locally. Unit comes in as a prop — SharePage overrides it to the
 * owner's unit, TradeJournalView reads the viewer's.
 */

export function ResultStatCard({ kpis, unit, saldo = null }: { kpis: OverviewKpis; unit: ResultUnit; saldo?: number | null }) {
  const { t } = useTranslation();
  const ctx = { rMultiple: kpis.totalR, rAssumed: kpis.rAssumedN > 0, amount: pctToAmount(kpis.totalResultaat, saldo) };
  return (
    <StatCard
      label={t("journal.statResult")}
      value={formatResult(kpis.totalResultaat, unit, ctx)}
      tone={resultDisplayValue(kpis.totalResultaat, unit, ctx) >= 0 ? "up" : "down"}
    />
  );
}

export function ProfitFactorStatCard({ kpis }: { kpis: OverviewKpis }) {
  const { t } = useTranslation();
  return (
    <StatCard
      label={t("journal.statProfitFactor")}
      value={formatProfitFactor(kpis.profitFactor)}
      tone={kpis.profitFactor == null ? "neutral" : kpis.profitFactor >= 1 ? "up" : "down"}
    />
  );
}

export function AvgRStatCard({ kpis }: { kpis: OverviewKpis }) {
  const { t } = useTranslation();
  return (
    <StatCard
      label={t("journal.statAvgR")}
      value={kpis.avgR != null ? `${kpis.rAssumedN > 0 ? "~" : ""}${kpis.avgR > 0 ? "+" : ""}${kpis.avgR.toFixed(2)}R` : "—"}
      tone={kpis.avgR != null ? (kpis.avgR >= 0 ? "up" : "down") : "neutral"}
      sub={
        kpis.avgR != null
          ? kpis.rAssumedN > 0
            ? `${t("journal.statTotalR", { total: kpis.totalR.toFixed(2) })} · ${t("journal.assumedRiskShort", { count: kpis.rAssumedN })}`
            : t("journal.statTotalR", { total: kpis.totalR.toFixed(2) })
          : undefined
      }
    />
  );
}

export function MaxDrawdownStatCard({ kpis }: { kpis: OverviewKpis }) {
  const { t } = useTranslation();
  return (
    <StatCard
      label={t("journal.statMaxDrawdown")}
      value={`${kpis.maxDrawdownPct > 0 ? "-" : ""}${kpis.maxDrawdownPct}%`}
      tone={kpis.maxDrawdownPct > 0 ? "down" : "neutral"}
    />
  );
}
