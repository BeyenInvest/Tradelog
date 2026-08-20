import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Share2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ShareReviewModal } from "@/components/share/ShareReviewModal";
import type { ReviewRef } from "@/lib/share/shareLinks";

/**
 * The Deel-knop for a review header (Fase M sessie 2) — owns its beta gate,
 * open-state and the ShareReviewModal mount, so ReviewDetail and
 * PeriodicReviewDetail each add exactly one line. Renders nothing outside beta
 * (share-link management is beta-gated; the token view itself is per-token).
 */
export function ShareReviewButton({ reviewRef }: { reviewRef: ReviewRef }) {
  const { t } = useTranslation();
  const { profile, betaFeatures } = useAuth();
  const [open, setOpen] = useState(false);

  if (!betaFeatures || !profile) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("share.reviewButton")}
        aria-label={t("share.reviewButton")}
        className="p-1.5 rounded-md hover:bg-ink/5 text-muted hover:text-ink"
      >
        <Share2 size={14} />
      </button>
      {open && <ShareReviewModal userId={profile.id} reviewRef={reviewRef} onClose={() => setOpen(false)} />}
    </>
  );
}
