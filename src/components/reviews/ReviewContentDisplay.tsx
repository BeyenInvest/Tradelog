import { useTranslation } from "react-i18next";
import { ContentBlock, VoiceBlock, ActiesList, TakeawayQuote, OverallCommentBlock } from "./ReviewContentBlocks";

interface ReviewContentDisplayProps {
  verhalen?: string | null;
  technisch: string | null;
  mentaal_owner: string | null;
  mentaal_trader: string | null;
  acties: string[];
  takeaway: string | null;
  overall_comment: string | null;
}

/** Read-only rendering of the technisch/mentaal/acties/takeaway/overall-comment fields, shared by weekly and periodic review detail views. */
export function ReviewContentDisplay({ verhalen, technisch, mentaal_owner, mentaal_trader, acties, takeaway, overall_comment }: ReviewContentDisplayProps) {
  const { t } = useTranslation();
  // Fase F: the merged, neutrally-labelled review. Legacy two-voice WPM reviews
  // still render in full — mentaal_owner is the live field; any legacy
  // mentaal_trader text is appended into the single mental block.
  return (
    <>
      {verhalen && <ContentBlock label={t("reviewContent.verhalenNeutral")}>{verhalen}</ContentBlock>}
      {technisch && <ContentBlock label={t("reviewContent.technisch")}>{technisch}</ContentBlock>}
      {(mentaal_owner || mentaal_trader) && (
        <VoiceBlock label={t("reviewContent.mentaal")}>{[mentaal_owner, mentaal_trader].filter(Boolean).join("\n\n")}</VoiceBlock>
      )}
      <ActiesList label={t("reviewContent.acties")} items={acties} />
      {takeaway && <TakeawayQuote label={t("reviewContent.takeaway")}>{takeaway}</TakeawayQuote>}
      {overall_comment && <OverallCommentBlock>{overall_comment}</OverallCommentBlock>}
    </>
  );
}
