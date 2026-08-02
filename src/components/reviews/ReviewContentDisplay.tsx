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
  return (
    <>
      {technisch && <ContentBlock label="Technisch">{technisch}</ContentBlock>}
      {(mentaal_owner || mentaal_trader) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mentaal_owner && <VoiceBlock label="Mentaal — Owner">{mentaal_owner}</VoiceBlock>}
          {mentaal_trader && <VoiceBlock label="Mentaal — Trader">{mentaal_trader}</VoiceBlock>}
        </div>
      )}
      <ActiesList label="Acties" items={acties} />
      {takeaway && <TakeawayQuote label="Wat neem ik mee?">{takeaway}</TakeawayQuote>}
      {overall_comment && <OverallCommentBlock>{overall_comment}</OverallCommentBlock>}
    </>
  );
}
