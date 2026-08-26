import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";

/** Which pair of middle columns a trade row shows. "legacy" = the Weekly Phase Method Concept/Entry columns (dead — always "—" — for any other journal); "modern" swaps them for the universal Richting/R columns. Threaded from the caller (which knows the active journal) so the shared header/item stay usable in the anonymous share views too. */
export type TradeColumnMode = "legacy" | "modern";

/** Column header row shared by TradeList and review trade groups — 8 columns (7 with fasen hidden), last one reserved for row actions (empty when read-only). `hideFaseOverride`: anonymous share views pass the owner's hide_fase instead of the viewer's (who has no profile) — same pattern as BacktestingAnalysisView. */
export function TradeListHeader({
  hideFaseOverride,
  columnMode = "legacy",
}: { hideFaseOverride?: boolean; columnMode?: TradeColumnMode } = {}) {
  const { t } = useTranslation();
  const { hideFase: ownHideFase } = useAuth();
  const hideFase = hideFaseOverride ?? ownHideFase;
  const modern = columnMode === "modern";
  return (
    <div className={`grid ${hideFase ? "grid-cols-[repeat(6,minmax(0,1fr))_1.7fr]" : "grid-cols-[repeat(7,minmax(0,1fr))_1.7fr]"} gap-3 font-body text-[11px] uppercase tracking-wide pb-2 mb-1 text-muted border-b border-border`}>
      <span>{t("list.colDate")}</span>
      <span>{t("list.colPair")}</span>
      {!hideFase && <span>{t("list.colFase")}</span>}
      <span>{modern ? t("list.colDirection") : t("list.colConcept")}</span>
      <span className={modern ? "text-right" : ""}>{modern ? t("list.colR") : t("list.colEntry")}</span>
      <span>{t("list.colOutcome")}</span>
      <span className="text-right">{t("list.colResult")}</span>
      <span />
    </div>
  );
}
