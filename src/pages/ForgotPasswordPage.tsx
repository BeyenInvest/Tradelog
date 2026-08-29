import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { LogoLockup } from "@/components/ui/Logo";
import { CaptchaWidget } from "@/components/ui/CaptchaWidget";
import { toErrorMessage } from "@/lib/errorMessage";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { session, sendPasswordReset } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);

  if (session) return <Navigate to="/journal" replace />;

  async function handleForgotPassword(values: ForgotPasswordFormValues) {
    setError(null);
    try {
      await sendPasswordReset(values.email, captchaToken);
    } catch (err) {
      // Deliberately still shown as success below even on error, except for
      // hard failures like a captcha rejection — those need to surface so
      // the user can retry, rather than silently going nowhere.
      setError(toErrorMessage(err, t("auth.forgotFailed")));
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body">
      <div className="w-full max-w-sm rounded-xl p-8 bg-surface border border-border">
        <div className="mb-8">
          <LogoLockup size={30} className="text-gold" />
        </div>

        {sent ? (
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-xl italic text-ink">{t("auth.checkEmailTitle")}</h1>
            <p className="text-sm text-muted">{t("auth.forgotSentBody")}</p>
            <Link to="/login" className="text-xs text-gold hover:underline w-fit">
              {t("auth.backToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleForgotPassword)} className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t("auth.forgotIntro")}</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted" htmlFor="email">
                {t("auth.email")}
              </label>
              <input
                id="email"
                type="email"
                {...register("email")}
                className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-loss">{t(errors.email.message!)}</p>}
            </div>

            <CaptchaWidget onToken={setCaptchaToken} />

            {error && <p className="text-xs text-loss">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-lg py-2 font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
            >
              {isSubmitting ? t("common.submitting") : t("auth.sendLink")}
            </button>

            <Link to="/login" className="text-xs text-muted hover:text-gold text-center">
              {t("auth.backToLogin")}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
