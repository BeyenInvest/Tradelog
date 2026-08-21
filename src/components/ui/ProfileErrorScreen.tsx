import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";

/**
 * Full-screen blocker for a signed-in session whose profile fetch failed (audit
 * blocker N1). The profile carries the active journal — rendering the app
 * without it would misfile every new trade into the `null`-journal, so the only
 * ways forward are retrying the fetch or signing out.
 */
export function ProfileErrorScreen() {
  const { t } = useTranslation();
  const { retryProfile, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await retryProfile();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm flex flex-col gap-4 text-center">
        <h1 className="font-display text-2xl italic text-ink">{t("auth.profileErrorTitle")}</h1>
        <p className="font-body text-sm text-muted">{t("auth.profileErrorBody")}</p>
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={retrying}
          className="rounded-lg py-2 font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
        >
          {retrying ? t("common.submitting") : t("auth.profileErrorRetry")}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="font-body text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}
