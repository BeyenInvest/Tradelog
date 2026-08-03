import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { CaptchaWidget } from "@/components/ui/CaptchaWidget";
import { toErrorMessage } from "@/lib/errorMessage";
import { signupSchema, type SignupFormValues } from "@/lib/validation";

export default function SignupPage() {
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
      const { needsEmailConfirmation } = await signUp(values.email, values.password, captchaToken);
      if (needsEmailConfirmation) {
        setCheckEmail(true);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Registreren is mislukt"));
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body">
      <div className="w-full max-w-sm rounded-xl p-8 bg-surface border border-border">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <LogoMark size={22} className="text-gold" />
            <span className="font-display text-2xl italic text-ink"><Wordmark /></span>
          </div>
          <p className="mt-1 text-xs text-muted font-body">Eyes on every trade.</p>
        </div>

        {checkEmail ? (
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-xl italic text-ink">Check je e-mail</h1>
            <p className="text-sm text-muted">
              We hebben een bevestigingslink gestuurd. Klik op de link in die e-mail om je account te activeren en
              daarna in te loggen.
            </p>
            <Link to="/login" className="text-xs text-gold hover:underline w-fit">
              Terug naar inloggen
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleSignup)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                {...register("email")}
                className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-loss">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted" htmlFor="password">
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                {...register("password")}
                className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
                autoComplete="new-password"
              />
              {errors.password && <p className="text-xs text-loss">{errors.password.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted" htmlFor="confirmPassword">
                Bevestig wachtwoord
              </label>
              <input
                id="confirmPassword"
                type="password"
                {...register("confirmPassword")}
                className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
                autoComplete="new-password"
              />
              {errors.confirmPassword && <p className="text-xs text-loss">{errors.confirmPassword.message}</p>}
            </div>

            <label className="flex items-start gap-2 text-xs text-muted">
              <input type="checkbox" {...register("acceptTerms")} className="mt-0.5" />
              <span>
                Ik ga akkoord met de{" "}
                <Link to="/terms" target="_blank" className="text-gold hover:underline">
                  Algemene Voorwaarden
                </Link>{" "}
                en het{" "}
                <Link to="/privacy" target="_blank" className="text-gold hover:underline">
                  Privacybeleid
                </Link>
              </span>
            </label>
            {errors.acceptTerms && <p className="text-xs text-loss">{errors.acceptTerms.message}</p>}

            <CaptchaWidget onToken={setCaptchaToken} />

            {error && <p className="text-xs text-loss">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-lg py-2 font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
            >
              {isSubmitting ? "Bezig..." : "Account aanmaken"}
            </button>

            <p className="text-xs text-muted text-center">
              Al een account?{" "}
              <Link to="/login" className="text-gold hover:underline">
                Inloggen
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
