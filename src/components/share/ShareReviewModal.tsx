import { useTranslation } from "react-i18next";
import { ShareLinksModal } from "@/components/share/ShareLinksModal";
import {
  createReviewShareLink, listReviewShareLinks, shareReviewUrl, type ReviewRef,
} from "@/lib/share/shareLinks";

/**
 * Share-links for one weekly/periodic review (Fase M sessie 2, beta-gated by
 * the caller) — the generic ShareLinksModal wired to the review list/create/URL
 * (migration 0042). A revoked or deleted review kills its links server-side.
 */
export function ShareReviewModal({
  userId,
  reviewRef,
  onClose,
}: {
  userId: string;
  reviewRef: ReviewRef;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ShareLinksModal
      title={t("share.reviewModalTitle")}
      subtitle={t("share.reviewModalSubtitle")}
      list={() => listReviewShareLinks(reviewRef)}
      create={(expiresAt) => createReviewShareLink(userId, reviewRef, expiresAt)}
      urlFor={(token) => shareReviewUrl(window.location.origin, token)}
      onClose={onClose}
    />
  );
}
