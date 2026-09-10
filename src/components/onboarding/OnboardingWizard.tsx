import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { LogoMark } from "@/components/ui/Logo";
import { JournalBuilder } from "@/components/settings/JournalBuilder";
import { timezoneOptions, guessTimezone } from "@/lib/timezones";
import { toErrorMessage } from "@/lib/errorMessage";

/**
 * First-run onboarding wizard (Fase N4). A one-time full-screen takeover for a
 * brand-new account: step 1 collects the only two profile fields that do a job
 * (display name + timezone — no street/phone, see memory), step 2 lets the user
 * shape a starting journal (a preset/style or stay blank), reusing the journal
 * builder. Finishing or skipping stamps `profiles.onboarded_at`, so it never
 * shows again.
 *
 * Shows once per account, gated only on onboarded_at being null (un-gated from
 * betaFeatures at the public beta launch — every new user gets it, not just beta
 * accounts). Mounted once as an overlay in the router's protected layout, above
 * the AppShell, so it is route-independent. Renders nothing when it shouldn't
 * show — the hook runs first, then the early return, so hook order stays stable.
 */
export function OnboardingWizard() {
  const { profile } = useAuth();
  // Strictly `=== null`, not falsy: an ISO string means already onboarded, and
  // `undefined` means the 0041 column isn't on this DB yet. Deploy lands on prod
  // (via push) before the owner runs the migration by hand — during that window
  // the value is `undefined`, so we must stay inert rather than show an overlay
  // whose "done" write would fail against the missing column and trap the user.
  if (!profile || profile.onboarded_at !== null) return null;
  return <OnboardingWizardInner />;
}

// Entrance animation, scoped to this overlay and reduced-motion-safe. Kept inline
// (not global index.css) so the whole first-run look lives in one file.
const OB_STYLE = `
@keyframes obUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.ob-up { animation: obUp .55s cubic-bezier(.16,.84,.44,1) both; }
@media (prefers-reduced-motion: reduce) { .ob-up { animation: none; } }
`;

function OnboardingWizardInner() {
  const { t } = useTranslation();
  const { profile, updateProfile } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(profile?.display_name ?? "");
  // Prefill the timezone: honour an already-customised value, otherwise suggest
  // the visitor's own zone rather than the reference default 'Europe/Brussels'.
  const [tz, setTz] = useState(() => {
    const stored = profile?.timezone;
    if (stored && stored !== "Europe/Brussels") return stored;
    return guessTimezone() ?? stored ?? "Europe/Brussels";
  });
  const zones = useMemo(() => timezoneOptions(tz), [tz]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // a11y: keep keyboard focus inside the first-run takeover (N15).
  const containerRef = useFocusTrap<HTMLDivElement>();

  /** Persist name + timezone, then advance to the "shape a journal" step. */
  async function saveProfileAndNext() {
    setError(null);
    setBusy(true);
    try {
      await updateProfile({ display_name: name.trim() || null, timezone: tz });
      setStep(2);
    } catch (err) {
      setError(toErrorMessage(err, t("onboarding.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  /** Stamp onboarded_at — the gate flips false and this overlay unmounts. */
  async function complete() {
    setError(null);
    setBusy(true);
    try {
      await updateProfile({ onboarded_at: new Date().toISOString() });
    } catch (err) {
      setError(toErrorMessage(err, t("onboarding.saveFailed")));
      setBusy(false); // stay open on failure so the user can retry
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label={t("onboarding.welcomeTitle")}
    >
      <style>{OB_STYLE}</style>
      <OnboardingAmbient />

      <div className="relative min-h-full flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-lg flex flex-col items-center gap-7">
          {/* Brand mark in a soft gold halo + step indicator */}
          <div className="ob-up flex flex-col items-center gap-4">
            <div
              className="relative flex h-16 w-16 items-center justify-center rounded-full border border-gold/30 bg-gold/[0.06]"
              style={{ boxShadow: "0 0 0 7px rgb(var(--color-gold) / 0.05), inset 0 0 22px rgb(var(--color-gold) / 0.12)" }}
            >
              <LogoMark size={26} className="text-gold" />
            </div>
            <StepIndicator step={step} label={t("onboarding.stepOf", { n: step, total: 2 })} />
          </div>

          {/* Card */}
          <div
            className="ob-up w-full rounded-2xl border border-border bg-surface/85 backdrop-blur-sm p-6 sm:p-8 flex flex-col gap-6"
            style={{ animationDelay: "60ms", boxShadow: "0 28px 64px -32px rgb(0 0 0 / 0.55)" }}
          >
            {step === 1 ? (
              <>
                <Intro
                  eyebrow={t("onboarding.eyebrow")}
                  title={t("onboarding.welcomeTitle")}
                  body={t("onboarding.welcomeBody")}
                />

                <div className="flex flex-col gap-4">
                  <Field label={t("onboarding.nameLabel")}>
                    <input
                      type="text"
                      value={name}
                      maxLength={60}
                      autoFocus
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("settings.displayNamePlaceholder")}
                      className="input"
                    />
                  </Field>

                  <Field label={t("onboarding.timezoneLabel")} hint={t("onboarding.timezoneHint")}>
                    <select value={tz} onChange={(e) => setTz(e.target.value)} className="input">
                      {zones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {error && <p className="font-mono text-[11px] text-loss">{error}</p>}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => void complete()}
                    disabled={busy}
                    className="font-body text-sm text-muted hover:text-ink disabled:opacity-40 transition-colors"
                  >
                    {t("onboarding.skip")}
                  </button>
                  <PrimaryButton busy={busy} onClick={() => void saveProfileAndNext()}>
                    {busy ? t("common.submitting") : t("onboarding.continue")}
                    <ArrowRight size={15} />
                  </PrimaryButton>
                </div>
              </>
            ) : (
              <>
                <Intro
                  eyebrow={t("onboarding.eyebrow2")}
                  title={t("onboarding.journalTitle")}
                  body={t("onboarding.journalBody")}
                />

                {/* The unified builder: a starter set pre-ticks blocks the user tweaks,
                    or "Blanco" for an empty journal. Filling the brand-new account's
                    existing empty journal (reuseActiveIfEmpty), then stamping onboarded. */}
                <JournalBuilder reuseActiveIfEmpty onDone={() => void complete()} />

                {error && <p className="font-mono text-[11px] text-loss">{error}</p>}

                <div className="flex items-center justify-between gap-3 border-t border-border-soft pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={busy}
                    className="font-body text-sm text-muted hover:text-ink disabled:opacity-40 transition-colors"
                  >
                    {t("onboarding.back")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void complete()}
                    disabled={busy}
                    className="font-body text-sm text-muted hover:text-ink disabled:opacity-40 transition-colors"
                  >
                    {busy ? t("common.submitting") : t("onboarding.skip")}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="ob-up flex flex-col items-center gap-2" style={{ animationDelay: "120ms" }}>
            <p className="text-center font-mono text-[11px] text-faint">{t("onboarding.reassure")}</p>
            {/* The Gids was only reachable from the sidebar, which the first-run takeover covers (E8).
                Opens in a new tab so peeking at it doesn't throw away wizard progress. */}
            <a
              href="/help"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-body text-xs text-gold underline-offset-2 hover:underline"
            >
              <HelpCircle size={13} /> {t("onboarding.guideLink")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Eyebrow (mono/gold) + serif headline + muted body — shared by both steps. */
function Intro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">{eyebrow}</span>
      <h1 className="font-display text-3xl sm:text-[2rem] leading-[1.1] italic text-ink">{title}</h1>
      <p className="font-body text-sm text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-body text-sm text-ink">{label}</span>
      {hint && <span className="font-mono text-xs text-muted -mt-1">{hint}</span>}
      {children}
    </label>
  );
}

function PrimaryButton({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40 transition-transform hover:-translate-y-px"
      style={{ boxShadow: "0 10px 28px -10px rgb(var(--color-gold) / 0.6)" }}
    >
      {children}
    </button>
  );
}

/** Two-segment progress with a "Step n of 2" label. */
function StepIndicator({ step, label }: { step: 1 | 2; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5" aria-hidden>
        {[1, 2].map((n) => (
          <span
            key={n}
            className={`h-1.5 rounded-full transition-all duration-300 ${n <= step ? "w-7 bg-gold" : "w-1.5 bg-border"}`}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

/** Ambient backdrop: a soft gold glow from the top plus a faint grid that fades
 *  out — theme-aware via the --color tokens, purely decorative. */
function OnboardingAmbient() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ background: "radial-gradient(72% 48% at 50% -6%, rgb(var(--color-gold) / 0.12), transparent 64%)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--color-border) / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--color-border) / 0.6) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          maskImage: "radial-gradient(78% 58% at 50% 0%, #000 28%, transparent 76%)",
          WebkitMaskImage: "radial-gradient(78% 58% at 50% 0%, #000 28%, transparent 76%)",
          opacity: 0.3,
        }}
      />
    </div>
  );
}
