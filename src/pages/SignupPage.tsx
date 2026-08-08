import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { CaptchaWidget } from "@/components/ui/CaptchaWidget";
import { toErrorMessage } from "@/lib/errorMessage";
import { signupSchema, type SignupFormValues } from "@/lib/validation";

export default function SignupPage() {
  const { t } = useTranslation();
  const { session, signUp } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) });
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
  const [checkEmail, setCheckEmail] = useState(false);

  if (session) return <Navigate to="/journal" replace />;

  async function handleSignup(values: SignupFormValues) {
    setError(null);
    try {
      const { needsEmailConfirmation } = await signUp(values.email, values.password, values.displayName, captchaToken);
      if (needsEmailConfirmation) {
        setCheckEmail(true);
      }
    } catch (err) {
      setError(toErrorMessage(err, t("auth.signupFailed")));
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body">
      <div className="w-full max-w-sm rounded-xl p-8 bg-surface border border-border">
        <div className="mb-8">
          <div className="flex items-center gap-2.5">
            <LogoMark size={32} className="text-gold" />
            <span className="font-display text-3xl italic text-ink"><Wordmark /></span>
          </div>
          <p className="mt-1.5 text-xs text-muted font-body">{t("common.tagline")}</p>
        </div>

        {checkEmail ? (
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-xl italic text-ink">{t("auth.checkEmailTitle")}</h1>
            <p className="text-sm text-muted">{t("auth.signupCheckEmailBody")}</p>
            <Link to="/login" className="text-xs text-gold hover:underline w-fit">
              {t("auth.backToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleSignup)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted" htmlFor="displayName">
                {t("auth.name")}
              </label>
              <input
                id="displayName"
                type="text"
                {...register("displayName")}
                className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
                autoComplete="name"
              />
              {errors.displayName && <p className="text-xs text-loss">{t(errors.displayName.message!)}</p>}
            </div>

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

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted" htmlFor="password">
                {t("auth.password")}
              </label>
              <input
                id="password"
                type="password"
                {...register("password")}
                className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
                autoComplete="new-password"
              />
              {errors.password && <p className="text-xs text-loss">{t(errors.password.message!)}</p>}
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

            <label className="flex items-start gap-2 text-xs text-muted">
              <input type="checkbox" {...register("acceptTerms")} className="mt-0.5" />
              <span>
                {t("auth.acceptTermsPre")}
                <Link to="/terms" target="_blank" className="text-gold hover:underline">
                  {t("auth.termsLink")}
                </Link>
                {t("auth.acceptTermsMid")}
                <Link to="/privacy" target="_blank" className="text-gold hover:underline">
                  {t("auth.privacyLink")}
                </Link>
              </span>
            </label>
            {errors.acceptTerms && <p className="text-xs text-loss">{t(errors.acceptTerms.message!)}</p>}

            <CaptchaWidget onToken={setCaptchaToken} />

            {error && <p className="text-xs text-loss">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-lg py-2 font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
            >
              {isSubmitting ? t("common.submitting") : t("auth.createAccount")}
            </button>

            <p className="text-xs text-muted text-center">
              {t("auth.alreadyAccount")}
              <Link to="/login" className="text-gold hover:underline">
                {t("auth.login")}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
