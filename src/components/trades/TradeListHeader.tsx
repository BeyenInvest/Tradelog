import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";

/** Column header row shared by TradeList and review trade groups — 8 columns (7 with fasen hidden), last one reserved for row actions (empty when read-only). `hideFaseOverride`: anonymous share views pass the owner's hide_fase instead of the viewer's (who has no profile) — same pattern as BacktestingAnalysisView. */
export function TradeListHeader({ hideFaseOverride }: { hideFaseOverride?: boolean } = {}) {
  const { t } = useTranslation();
  const { hideFase: ownHideFase } = useAuth();
  const hideFase = hideFaseOverride ?? ownHideFase;
  return (
    <div className={`grid ${hideFase ? "grid-cols-7" : "grid-cols-8"} gap-3 font-body text-[11px] uppercase tracking-wide pb-2 mb-1 text-muted border-b border-border`}>
      <span>{t("list.colDate")}</span>
      <span>{t("list.colPair")}</span>
      {!hideFase && <span>{t("list.colFase")}</span>}
      <span>{t("list.colConcept")}</span>
      <span>{t("list.colEntry")}</span>
      <span>{t("list.colOutcome")}</span>
      <span className="text-right">{t("list.colResult")}</span>
      <span />
    </div>
  );
}
