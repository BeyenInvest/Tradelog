import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { BullBearLogo } from "@/components/ui/BullBearLogo";
import { CaptchaWidget } from "@/components/ui/CaptchaWidget";
import { toErrorMessage } from "@/lib/errorMessage";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validation";

export default function ForgotPasswordPage() {
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
      setError(toErrorMessage(err, "Versturen is mislukt, probeer het opnieuw"));
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body">
      <div className="w-full max-w-sm rounded-xl p-8 bg-surface border border-border">
        <div className="flex items-center gap-2 mb-8">
          <BullBearLogo size={22} className="text-gold" />
          <span className="font-display text-2xl italic text-ink">Beyen Invest</span>
        </div>

        {sent ? (
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-xl italic text-ink">Check je e-mail</h1>
            <p className="text-sm text-muted">
              Als dit e-mailadres bekend is, ontvang je een link om je wachtwoord opnieuw in te stellen.
            </p>
            <Link to="/login" className="text-xs text-gold hover:underline w-fit">
              Terug naar inloggen
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleForgotPassword)} className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Vul je e-mailadres in en we sturen je een link om je wachtwoord opnieuw in te stellen.
            </p>

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

            <CaptchaWidget onToken={setCaptchaToken} />

            {error && <p className="text-xs text-loss">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-lg py-2 font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
            >
              {isSubmitting ? "Bezig..." : "Verstuur link"}
            </button>

            <Link to="/login" className="text-xs text-muted hover:text-gold text-center">
              Terug naar inloggen
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
