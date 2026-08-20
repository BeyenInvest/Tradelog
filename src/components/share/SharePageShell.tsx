import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/ui/Logo";

/**
 * Shared chrome of the anonymous share pages (Fase M): brand header +
 * read-only badge, powered-by footer, and the generic invalid-token card —
 * SharePage and ShareReviewPage differ only in width and body.
 */
export function SharePageShell({ maxWidthClass, children }: { maxWidthClass: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full bg-bg font-body">
      <div className={`mx-auto w-full ${maxWidthClass} px-4 py-8 flex flex-col gap-5`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <LogoMark size={26} className="text-gold" />
            <span className="font-display text-2xl italic text-ink"><Wordmark /></span>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-2 font-body text-xs text-muted">
            <Lock size={13} /> {t("share.readOnlyBadge")}
          </span>
        </div>

        {children}

        <p className="text-center font-body text-xs text-faint pt-4 pb-2">
          {t("share.poweredByPrefix")}{" "}
          <Link to="/" className="text-muted hover:text-gold underline-offset-2 hover:underline">
            Beyen Invest
          </Link>
        </p>
      </div>
    </div>
  );
}

/** The one generic message for an invalid/revoked/expired token (deliberately not saying which), or for a network failure. */
export function ShareInvalidState({ failed }: { failed: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body px-4">
      <div className="w-full max-w-md rounded-xl p-8 bg-surface border border-border text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <LogoMark size={30} className="text-gold" />
          <span className="font-display text-3xl italic text-ink"><Wordmark /></span>
        </div>
        <h1 className="font-display text-xl italic text-ink mb-2">
          {failed ? t("share.loadFailedTitle") : t("share.invalidTitle")}
        </h1>
        <p className="text-sm text-muted">{failed ? t("share.loadFailedBody") : t("share.invalidBody")}</p>
      </div>
    </div>
  );
}
