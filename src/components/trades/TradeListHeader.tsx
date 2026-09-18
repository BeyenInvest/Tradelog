import { useTranslation } from "react-i18next";

/**
 * Column header row shared by TradeList and review trade groups — 7 columns, the
 * last reserved for row actions (empty when read-only). Since the fase-retirement
 * (0059) every journal shows the same universal columns (Richting/R); the former
 * Weekly-Phase-Method Concept/Entry/fase columns are gone.
 */
export function TradeListHeader() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[repeat(6,minmax(0,1fr))_1.7fr] gap-3 font-body text-[11px] uppercase tracking-wide pb-2 mb-1 text-muted border-b border-border">
      <span>{t("list.colDate")}</span>
      <span>{t("list.colPair")}</span>
      <span>{t("list.colDirection")}</span>
      <span className="text-right">{t("list.colR")}</span>
      <span>{t("list.colOutcome")}</span>
      <span className="text-right">{t("list.colResult")}</span>
      <span />
    </div>
  );
}
