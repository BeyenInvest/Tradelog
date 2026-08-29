import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { LogoLockup } from "@/components/ui/Logo";
import { CaptchaWidget } from "@/components/ui/CaptchaWidget";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { toErrorMessage } from "@/lib/errorMessage";

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);

  if (session) return <Navigate to="/journal" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password, captchaToken);
    } catch (err) {
      setError(toErrorMessage(err, t("auth.loginFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body">
      <div className="w-full max-w-sm rounded-xl p-8 bg-surface border border-border">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <LogoLockup size={30} className="text-gold" />
            <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-gold font-body">{t("common.tagline")}</p>
          </div>
          <LanguageToggle iconOnly />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted" htmlFor="email">
              {t("auth.email")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted" htmlFor="password">
              {t("auth.password")}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
              autoComplete="current-password"
            />
          </div>

          <CaptchaWidget onToken={setCaptchaToken} />

          {error && <p className="text-xs text-loss">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg py-2 font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
          >
            {submitting ? t("common.submitting") : t("auth.login")}
          </button>

          <div className="flex items-center justify-between text-xs text-muted">
            <Link to="/forgot-password" className="hover:text-gold">
              {t("auth.forgotPassword")}
            </Link>
            <Link to="/signup" className="hover:text-gold">
              {t("auth.noAccount")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
