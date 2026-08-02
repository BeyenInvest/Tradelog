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

const OVERZICHT_LABEL: Partial<Record<PeriodType, string>> = {
  quarter: "Maandoverzicht",
  year: "Kwartaaloverzicht",
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
  const overzichtLabel = OVERZICHT_LABEL[periodType];

  return (
    <>
      {technisch && <ContentBlock label="Genomen trades">{technisch}</ContentBlock>}
      {mentaal_owner && <ContentBlock label="Genomen trades met errors">{mentaal_owner}</ContentBlock>}
      {mentaal_trader && <ContentBlock label="Gemiste trades">{mentaal_trader}</ContentBlock>}
      <ActiesList label="Werkpunten" items={acties} />
      {takeaway && <TakeawayQuote label="Conclusie">{takeaway}</TakeawayQuote>}
      {overzichtLabel && periode_overzicht && <ContentBlock label={overzichtLabel}>{periode_overzicht}</ContentBlock>}
      {overall_comment && <OverallCommentBlock>{overall_comment}</OverallCommentBlock>}
    </>
  );
}
