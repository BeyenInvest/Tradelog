import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BullBearLogo } from "@/components/ui/BullBearLogo";

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to="/journal" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inloggen mislukt");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body">
      <div className="w-full max-w-sm rounded-xl p-8 bg-surface border border-border">
        <div className="flex items-center gap-2 mb-8">
          <BullBearLogo size={22} className="text-gold" />
          <span className="font-display text-2xl italic text-ink">Beyen Invest</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted" htmlFor="email">
              E-mail
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
              Wachtwoord
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

          {error && <p className="text-xs text-loss">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg py-2 font-body text-sm font-medium bg-gold text-bg disabled:opacity-60"
          >
            {submitting ? "Bezig..." : "Inloggen"}
          </button>
        </form>
      </div>
    </div>
  );
}
