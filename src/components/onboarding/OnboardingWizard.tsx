import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { JournalBuilder } from "@/components/settings/JournalBuilder";
import { timezoneOptions, guessTimezone } from "@/lib/timezones";
import { toErrorMessage } from "@/lib/errorMessage";

/**
 * First-run onboarding wizard (Fase N4). A one-time full-screen takeover for a
 * brand-new account: step 1 collects the only two profile fields that do a job
 * (display name + timezone — no street/phone, see memory), step 2 lets the user
 * pick a starting journal (a preset or stay blank), reusing the cyclus-6
 * PresetChooser. Finishing or skipping stamps `profiles.onboarded_at`, so it
 * never shows again.
 *
 * Shows once per account: gated only on onboarded_at being null. Mounted once as
 * an overlay in the router's protected layout, above the AppShell, so it is
 * route-independent. Renders nothing when it shouldn't show — the hook runs
 * first, then the early return, so hook order stays stable.
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

  /** Persist name + timezone, then advance to the "pick a journal" step. */
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
      <div className="min-h-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg flex flex-col gap-6">
          {/* Brand header + step indicator */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 text-ink">
              <LogoMark size={26} className="text-gold" />
              <Wordmark className="font-display text-2xl" />
            </div>
            <StepDots step={step} />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 flex flex-col gap-6">
            {step === 1 ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <h1 className="font-display text-2xl italic text-ink">{t("onboarding.welcomeTitle")}</h1>
                  <p className="font-body text-sm text-muted">{t("onboarding.welcomeBody")}</p>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-sm text-ink">{t("onboarding.nameLabel")}</span>
                  <input
                    type="text"
                    value={name}
                    maxLength={60}
                    autoFocus
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("settings.displayNamePlaceholder")}
                    className="input"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-sm text-ink">{t("onboarding.timezoneLabel")}</span>
                  <span className="font-mono text-xs text-muted">{t("onboarding.timezoneHint")}</span>
                  <select
                    value={tz}
                    onChange={(e) => setTz(e.target.value)}
                    className="mt-1 rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
                  >
                    {zones.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </label>

                {error && <p className="font-mono text-[11px] text-loss">{error}</p>}

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => void complete()}
                    disabled={busy}
                    className="font-body text-sm text-muted hover:text-ink disabled:opacity-40"
                  >
                    {t("onboarding.skip")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveProfileAndNext()}
                    disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40"
                  >
                    {busy ? t("common.submitting") : t("onboarding.continue")}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <h1 className="font-display text-2xl italic text-ink">{t("onboarding.journalTitle")}</h1>
                  <p className="font-body text-sm text-muted">{t("onboarding.journalBody")}</p>
                </div>

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
                    className="font-body text-sm text-muted hover:text-ink disabled:opacity-40"
                  >
                    {t("onboarding.back")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void complete()}
                    disabled={busy}
                    className="font-body text-sm text-muted hover:text-ink disabled:opacity-40"
                  >
                    {busy ? t("common.submitting") : t("onboarding.skip")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      {[1, 2].map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all ${n === step ? "w-6 bg-gold" : "w-1.5 bg-border"}`}
        />
      ))}
    </div>
  );
}
