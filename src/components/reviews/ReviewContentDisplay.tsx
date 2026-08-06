import { useTranslation } from "react-i18next";
import { ContentBlock, VoiceBlock, ActiesList, TakeawayQuote, OverallCommentBlock } from "./ReviewContentBlocks";

interface ReviewContentDisplayProps {
  technisch: string | null;
  mentaal_owner: string | null;
  mentaal_trader: string | null;
  acties: string[];
  takeaway: string | null;
  overall_comment: string | null;
}

/** Read-only rendering of the technisch/mentaal/acties/takeaway/overall-comment fields, shared by weekly and periodic review detail views. */
export function ReviewContentDisplay({ technisch, mentaal_owner, mentaal_trader, acties, takeaway, overall_comment }: ReviewContentDisplayProps) {
  const { t } = useTranslation();
  return (
    <>
      {technisch && <ContentBlock label={t("reviewContent.technisch")}>{technisch}</ContentBlock>}
      {(mentaal_owner || mentaal_trader) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mentaal_owner && <VoiceBlock label={t("reviewContent.mentaalOwner")}>{mentaal_owner}</VoiceBlock>}
          {mentaal_trader && <VoiceBlock label={t("reviewContent.mentaalTrader")}>{mentaal_trader}</VoiceBlock>}
        </div>
      )}
      <ActiesList label={t("reviewContent.acties")} items={acties} />
      {takeaway && <TakeawayQuote label={t("reviewContent.takeaway")}>{takeaway}</TakeawayQuote>}
      {overall_comment && <OverallCommentBlock>{overall_comment}</OverallCommentBlock>}
    </>
  );
}
