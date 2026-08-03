import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { toErrorMessage } from "@/lib/errorMessage";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validation";

/**
 * Lands here from the Supabase recovery email link, which the client SDK
 * exchanges for a live session before this page renders. Guards on `session`
 * itself (not just the PASSWORD_RECOVERY event) since the event can lag a
 * fast page load — an authenticated session is what actually matters here.
 */
export default function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleReset(values: ResetPasswordFormValues) {
    setError(null);
    try {
      await updatePassword(values.newPassword);
      setDone(true);
      setTimeout(() => navigate("/journal"), 1500);
    } catch (err) {
      setError(toErrorMessage(err, "Wachtwoord bijwerken is mislukt"));
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body">
      <div className="w-full max-w-sm rounded-xl p-8 bg-surface border border-border">
        <div className="flex items-center gap-2 mb-8">
          <LogoMark size={22} className="text-gold" />
          <span className="font-display text-2xl italic text-ink"><Wordmark /></span>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Laden...</p>
        ) : done ? (
          <p className="text-sm text-win">Wachtwoord bijgewerkt — je wordt doorgestuurd...</p>
        ) : !session ? (
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-xl italic text-ink">Link verlopen</h1>
            <p className="text-sm text-muted">
              Deze link om je wachtwoord opnieuw in te stellen is ongeldig of verlopen. Vraag een nieuwe aan.
            </p>
            <Link to="/forgot-password" className="text-xs text-gold hover:underline w-fit">
              Nieuwe link aanvragen
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleReset)} className="flex flex-col gap-4">
            <p className="text-sm text-muted">Kies een nieuw wachtwoord.</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted" htmlFor="newPassword">
                Nieuw wachtwoord
              </label>
              <input
                id="newPassword"
                type="password"
                {...register("newPassword")}
                className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
                autoComplete="new-password"
              />
              {errors.newPassword && <p className="text-xs text-loss">{errors.newPassword.message}</p>}
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

            {error && <p className="text-xs text-loss">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-lg py-2 font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
            >
              {isSubmitting ? "Bezig..." : "Wachtwoord bijwerken"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
