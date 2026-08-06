import { useTranslation } from "react-i18next";
import type { PeriodType } from "@/lib/constants";
import { ContentBlock, ActiesList, TakeawayQuote, OverallCommentBlock } from "./ReviewContentBlocks";

interface PeriodicReviewContentDisplayProps {
  periodType: PeriodType;
  technisch: string | null;
  mentaal_owner: string | null;
  mentaal_trader: string | null;
  acties: string[];
  takeaway: string | null;
  overall_comment: string | null;
  periode_overzicht: string | null;
}

const OVERZICHT_LABEL_KEY: Partial<Record<PeriodType, string>> = {
  quarter: "reviewContent.maandoverzicht",
  year: "reviewContent.kwartaaloverzicht",
};

/** Read-only rendering of a monthly/quarterly/yearly review — same columns as the weekly display, relabeled. */
export function PeriodicReviewContentDisplay({
  periodType,
  technisch,
  mentaal_owner,
  mentaal_trader,
  acties,
  takeaway,
  overall_comment,
  periode_overzicht,
}: PeriodicReviewContentDisplayProps) {
  const { t } = useTranslation();
  const overzichtLabelKey = OVERZICHT_LABEL_KEY[periodType];

  return (
    <>
      {technisch && <ContentBlock label={t("reviewContent.genomenTrades")}>{technisch}</ContentBlock>}
      {mentaal_owner && <ContentBlock label={t("reviewContent.genomenTradesErrors")}>{mentaal_owner}</ContentBlock>}
      {mentaal_trader && <ContentBlock label={t("reviewContent.gemisteTrades")}>{mentaal_trader}</ContentBlock>}
      <ActiesList label={t("reviewContent.werkpunten")} items={acties} />
      {takeaway && <TakeawayQuote label={t("reviewContent.conclusie")}>{takeaway}</TakeawayQuote>}
      {overzichtLabelKey && periode_overzicht && <ContentBlock label={t(overzichtLabelKey)}>{periode_overzicht}</ContentBlock>}
      {overall_comment && <OverallCommentBlock>{overall_comment}</OverallCommentBlock>}
    </>
  );
}
