import { useTranslation } from "react-i18next";
import { ContentBlock, VoiceBlock, ActiesList, TakeawayQuote, OverallCommentBlock } from "./ReviewContentBlocks";
import { readSectionDisplayText, readSectionList, reviewSectionLabel, type ReviewSection } from "@/lib/reviewSections";
import type { ReviewKind } from "@/lib/types";
import type { ReviewValueSource } from "@/lib/reviewSections";

interface ReviewSectionsDisplayProps {
  kind: ReviewKind;
  sections: ReviewSection[];
  /** The review row (built-in columns + content bag) to read values from. */
  source: ReviewValueSource;
}

/**
 * Config-driven read-only rendering of a review's sections (Fase N5) — the single
 * display path for weekly and periodic reviews, the owner's detail view, the
 * public share view and the admin view. Each section renders with its resolved
 * style (plain block / voice card / pull-quote / closing card / checklist), and
 * empty sections are omitted, matching the pre-N5 behaviour exactly when a journal
 * uses the built-in defaults.
 */
export function ReviewSectionsDisplay({ kind, sections, source }: ReviewSectionsDisplayProps) {
  const { t } = useTranslation();
  return (
    <>
      {sections.map((section) => {
        const label = reviewSectionLabel(t, section);
        if (section.inputType === "list") {
          // ActiesList already returns null when there are no items.
          return <ActiesList key={section.key} label={label} items={readSectionList(source, section)} />;
        }
        const body = readSectionDisplayText(kind, source, section);
        if (!body) return null;
        switch (section.style) {
          case "voice":
            return <VoiceBlock key={section.key} label={label}>{body}</VoiceBlock>;
          case "takeaway":
            return <TakeawayQuote key={section.key} label={label}>{body}</TakeawayQuote>;
          case "overall":
            return <OverallCommentBlock key={section.key} label={label}>{body}</OverallCommentBlock>;
          default:
            return <ContentBlock key={section.key} label={label}>{body}</ContentBlock>;
        }
      })}
    </>
  );
}
