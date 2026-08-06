import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { toErrorMessage } from "@/lib/errorMessage";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validation";

// Grace period to let a genuine PASSWORD_RECOVERY event catch up to a fast page load before
// falling back to "link expired" — see the passwordRecovery gate below.
const RECOVERY_EVENT_GRACE_MS = 2500;

/**
 * Lands here from the Supabase recovery email link — or is routed here by
 * ProtectedRoute after an accepted invite, which has no dedicated event of its
 * own (see useAuth) but sets the same `passwordRecovery` flag. Either way the
 * client SDK exchanges the link for a live session before this page renders,
 * and the form only unlocks once `passwordRecovery` is true — an ordinary
 * logged-in session is NOT enough. Without this, anyone with access to an
 * already-authenticated browser tab (shared/kiosk machine, forgotten laptop)
 * could navigate straight here and take over the account with no
 * re-authentication. The event can lag a fast page load, so we show a brief
 * "verifying" state instead of immediately declaring the link expired, and
 * only give up after a short grace period.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { session, passwordRecovery, isInvite, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [graceExpired, setGraceExpired] = useState(false);

  useEffect(() => {
    if (loading || passwordRecovery) return;
    const timer = setTimeout(() => setGraceExpired(true), RECOVERY_EVENT_GRACE_MS);
    return () => clearTimeout(timer);
  }, [loading, passwordRecovery]);

  const verified = session && passwordRecovery;
  const linkInvalid = !loading && (!session || graceExpired) && !verified;

  async function handleReset(values: ResetPasswordFormValues) {
    setError(null);
    try {
      await updatePassword(values.newPassword);
      setDone(true);
      setTimeout(() => navigate("/journal"), 1500);
    } catch (err) {
      setError(toErrorMessage(err, t("auth.resetFailed")));
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body">
      <div className="w-full max-w-sm rounded-xl p-8 bg-surface border border-border">
        <div className="flex items-center gap-2 mb-8">
          <LogoMark size={32} className="text-gold" />
          <span className="font-display text-3xl italic text-ink"><Wordmark /></span>
        </div>

        {loading ? (
          <p className="text-sm text-muted">{t("common.loading")}</p>
        ) : done ? (
          <p className="text-sm text-win">
            {isInvite ? t("auth.inviteDone") : t("auth.resetDone")}
          </p>
        ) : linkInvalid ? (
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-xl italic text-ink">{t("auth.linkExpiredTitle")}</h1>
            <p className="text-sm text-muted">
              {isInvite ? t("auth.inviteInvalid") : t("auth.resetInvalid")}
            </p>
            {!isInvite && (
              <Link to="/forgot-password" className="text-xs text-gold hover:underline w-fit">
                {t("auth.requestNewLink")}
              </Link>
            )}
          </div>
        ) : !verified ? (
          <p className="text-sm text-muted">{t("auth.verifyingLink")}</p>
        ) : (
          <form onSubmit={handleSubmit(handleReset)} className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {isInvite ? t("auth.inviteIntro") : t("auth.resetIntro")}
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted" htmlFor="newPassword">
                {isInvite ? t("auth.password") : t("auth.newPassword")}
              </label>
              <input
                id="newPassword"
                type="password"
                {...register("newPassword")}
                className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
                autoComplete="new-password"
              />
              {errors.newPassword && <p className="text-xs text-loss">{t(errors.newPassword.message!)}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted" htmlFor="confirmPassword">
                {t("auth.confirmPassword")}
              </label>
              <input
                id="confirmPassword"
                type="password"
                {...register("confirmPassword")}
                className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
                autoComplete="new-password"
              />
              {errors.confirmPassword && <p className="text-xs text-loss">{t(errors.confirmPassword.message!)}</p>}
            </div>

            {error && <p className="text-xs text-loss">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-lg py-2 font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
            >
              {isSubmitting ? t("common.submitting") : isInvite ? t("auth.activateAccount") : t("auth.updatePassword")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
