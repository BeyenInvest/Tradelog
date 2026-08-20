import { useTranslation } from "react-i18next";
import { ShareLinksModal } from "@/components/share/ShareLinksModal";
import { createShareLink, listShareLinks, shareUrl } from "@/lib/share/shareLinks";

/** Share-links for the active journal (Fase M) — the generic ShareLinksModal wired to the journal list/create/URL. */
export function ShareJournalModal({
  userId,
  methodologyId,
  onClose,
}: {
  userId: string;
  /** Active journal; null = the legacy/unscoped journal — same semantics as useTrades. */
  methodologyId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ShareLinksModal
      title={t("share.modalTitle")}
      subtitle={t("share.modalSubtitle")}
      list={() => listShareLinks(methodologyId)}
      create={(expiresAt) => createShareLink(userId, methodologyId, expiresAt)}
      urlFor={(token) => shareUrl(window.location.origin, token)}
      onClose={onClose}
    />
  );
}
