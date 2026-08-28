import { useMemo, useState, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import { useCustomOptions } from "@/hooks/useCustomOptions";
import { MethodologyEditor } from "@/components/settings/MethodologyEditor";
import { ReviewSectionsEditor } from "@/components/settings/ReviewSectionsEditor";
import { JournalInstruments } from "@/components/settings/JournalInstruments";
import { NewJournalCard } from "@/components/settings/JournalBuilder";
import { JournalOverview } from "@/components/settings/JournalOverview";
import { AdvancedAnalysisSettings } from "@/components/settings/AdvancedAnalysisSettings";
import { DeleteAccountModal } from "@/components/layout/DeleteAccountModal";
import { ENTRIES, RESULT_UNITS, TRADE_CONCEPTS, SUPPORT_EMAIL, type ResultUnit } from "@/lib/constants";
import { timezoneOptions } from "@/lib/timezones";
import { toErrorMessage } from "@/lib/errorMessage";
import { SUPPORTED_LANGS, type Lang } from "@/i18n";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { hideFase, betaFeatures, updateProfile } = useAuth();
  const { isLegacyMethodology } = useMethodology();
  const location = useLocation();
  // Set by the journal-switcher's "+ Nieuw journal" (route state): auto-open and
  // scroll to the preset picker, so that click completes its intent here.
  const openPresets = Boolean((location.state as { openPresets?: boolean } | null)?.openPresets);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleFase(showFase: boolean) {
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ hide_fase: !showFase });
    } catch (err) {
      setError(toErrorMessage(err, t("settings.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="flex flex-col gap-10 max-w-xl">
        <section className="flex flex-col gap-5">
          <SettingsSectionHeader
            title={t("settings.sectionDisplay")}
            description={t("settings.sectionDisplayDescription")}
          />

          <DisplayNameSettings />

          <TimezoneSettings />

          <LanguageSettings />

          {/* Fase J (0037): resultaat-eenheid %/R/geld. De weergave-conversie
              (R/geld in useResultDisplay) is af, dus dit staat voor iedereen aan. */}
          <ResultUnitSettings />
        </section>

        {/* Multi-journal configuration (verschillende journals + builder) —
            soft-launch: beta-flagged users only (0033) until the public launch.
            Above the legacy trading prefs: for a new trader this is the section
            that matters, the WPM-era cards below are secondary. */}
        {betaFeatures && (
          <section className="flex flex-col gap-5">
            <SettingsSectionHeader
              title={t("methodology.title")}
              description={t("methodology.description")}
            />
            <JournalOverview />
            <NewJournalCard defaultOpen={openPresets} />
            <MethodologyEditor />
            <ReviewSectionsEditor />
            <AdvancedAnalysisSettings />
            <JournalInstruments />
          </section>
        )}

        {/* Legacy Weekly Phase Method prefs: the fase toggle and the entry/concept
            option lists are all WPM-specific fields — meaningless for a modern
            (own/preset) journal, whose fase column is hidden and whose entry/concept
            fields don't exist. Show the whole section only for a legacy journal. */}
        {isLegacyMethodology && (
          <section className="flex flex-col gap-5">
            <SettingsSectionHeader
              title={t("settings.sectionTrading")}
              description={t("settings.sectionTradingDescription")}
            />

            <Card>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-body text-sm text-ink">{t("settings.showFases")}</p>
                  <p className="font-mono text-xs mt-1 text-muted">{t("settings.showFasesDescription")}</p>
                </div>
                <BooleanToggle value={!hideFase} onChange={handleToggleFase} labels={[t("settings.on"), t("settings.off")]} />
              </div>
              {saving && <p className="font-mono text-[11px] mt-3 text-muted">{t("settings.saving")}</p>}
              {error && <p className="font-mono text-[11px] mt-3 text-loss">{error}</p>}
            </Card>

            <CustomFieldOptions
              field="entry"
              baseList={ENTRIES}
              titleKey="settings.customEntryOptions"
              descriptionKey="settings.customEntryOptionsDescription"
              placeholderKey="settings.newEntryPlaceholder"
            />

            <CustomFieldOptions
              field="trade_concept"
              baseList={TRADE_CONCEPTS}
              titleKey="settings.customConceptOptions"
              descriptionKey="settings.customConceptOptionsDescription"
              placeholderKey="settings.newConceptPlaceholder"
            />
          </section>
        )}

        <section className="flex flex-col gap-5">
          <SettingsSectionHeader
            title={t("settings.sectionAccount")}
            description={t("settings.sectionAccountDescription")}
          />

          <SupportSettings />

          <DeleteAccountSettings />
        </section>
      </div>
    </>
  );
}

/**
 * Support / contact — the app's only user-facing way to reach us (there is no
 * in-app inbox yet). A plain mailto to the shared SUPPORT_EMAIL constant so the
 * address stays in one place; the copy also shows it as text so it's usable when
 * no mail client is configured.
 */
function SupportSettings() {
  const { t } = useTranslation();
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-body text-sm text-ink">{t("settings.support")}</p>
          <p className="font-mono text-xs mt-1 text-muted">
            {t("settings.supportDescription")} <span className="text-ink">{SUPPORT_EMAIL}</span>
          </p>
        </div>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="shrink-0 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold hover:opacity-90 transition-opacity"
        >
          {t("settings.supportCta")}
        </a>
      </div>
    </Card>
  );
}

/**
 * Self-service account deletion (GDPR erasure) — the only irreversible action in
 * Settings, so it lives in its own account section, styled as a danger zone, and
 * routes through the typed-phrase DeleteAccountModal before anything happens.
 * useAuth.deleteAccount() calls the delete_own_account RPC (0006) then signs out,
 * which drops the user back to /login via the auth-state listener.
 */
function DeleteAccountSettings() {
  const { t } = useTranslation();
  const { deleteAccount } = useAuth();
  const [showModal, setShowModal] = useState(false);

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-body text-sm text-ink">{t("deleteAccount.cardTitle")}</p>
          <p className="font-mono text-xs mt-1 text-muted">{t("deleteAccount.cardDescription")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="shrink-0 px-4 py-2 rounded-lg font-body text-sm font-medium border border-loss/40 text-loss hover:bg-loss/10 transition-colors"
        >
          {t("deleteAccount.button")}
        </button>
      </div>
      {showModal && (
        <DeleteAccountModal onConfirm={deleteAccount} onClose={() => setShowModal(false)} />
      )}
    </Card>
  );
}

/** Klein rubriek-kopje dat de instellingskaarten in logische groepen verdeelt. */
function SettingsSectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-border-soft pb-2">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <p className="font-mono text-xs mt-1 text-muted">{description}</p>
    </div>
  );
}

/**
 * Weergavenaam van de gebruiker (profiles.display_name) — o.a. gebruikt in de
 * header van de review-PDF. Leeg opslaan wist de naam (null), zodat de PDF het
 * "Reviewrapport voor …"-regeltje weer weglaat.
 */
function DisplayNameSettings() {
  const { t } = useTranslation();
  const { profile, updateProfile } = useAuth();
  const [value, setValue] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = value.trim() !== (profile?.display_name ?? "");

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile({ display_name: value.trim() || null });
      setSaved(true);
    } catch (err) {
      setError(toErrorMessage(err, t("settings.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <p className="font-body text-sm text-ink">{t("settings.displayName")}</p>
      <p className="font-mono text-xs mt-1 text-muted">{t("settings.displayNameDescription")}</p>

      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={value}
          maxLength={60}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder={t("settings.displayNamePlaceholder")}
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("common.save")}
        </button>
      </div>
      {saving && <p className="font-mono text-[11px] mt-2 text-muted">{t("settings.saving")}</p>}
      {saved && !saving && <p className="font-mono text-[11px] mt-2 text-win">{t("settings.saved")}</p>}
      {error && <p className="font-mono text-[11px] mt-2 text-loss">{error}</p>}
    </Card>
  );
}

/**
 * Resultaat-eenheid (Fase J / 0037): %, R of geld. Puur een weergave-voorkeur
 * (profiles.result_unit) — stats en opslag blijven in %. De daadwerkelijke
 * conversie in de views volgt in latere sub-slices; tot die tijd beta-only.
 */
function ResultUnitSettings() {
  const { t } = useTranslation();
  const { resultUnit, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels: Record<ResultUnit, string> = {
    percent: t("settings.resultUnitPercent"),
    R: t("settings.resultUnitR"),
    currency: t("settings.resultUnitCurrency"),
  };

  async function handleChange(unit: ResultUnit) {
    if (unit === resultUnit) return;
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ result_unit: unit });
    } catch (err) {
      setError(toErrorMessage(err, t("settings.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-body text-sm text-ink">{t("settings.resultUnit")}</p>
          <p className="font-mono text-xs mt-1 text-muted">{t("settings.resultUnitDescription")}</p>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-border divide-x divide-border overflow-hidden">
          {RESULT_UNITS.map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => void handleChange(unit)}
              disabled={saving}
              aria-pressed={resultUnit === unit}
              className={`px-3 py-1.5 text-xs font-body transition-colors disabled:opacity-50 ${
                resultUnit === unit ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {labels[unit]}
            </button>
          ))}
        </div>
      </div>
      {resultUnit === "currency" && (
        <p className="font-mono text-[11px] mt-3 text-muted">{t("settings.resultUnitCurrencyHint")}</p>
      )}
      {saving && <p className="font-mono text-[11px] mt-3 text-muted">{t("settings.saving")}</p>}
      {error && <p className="font-mono text-[11px] mt-3 text-loss">{error}</p>}
    </Card>
  );
}

function LanguageSettings() {
  const { t, i18n } = useTranslation();

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-body text-sm text-ink">{t("settings.language")}</p>
          <p className="font-mono text-xs mt-1 text-muted">{t("settings.languageDescription")}</p>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-border divide-x divide-border overflow-hidden">
          {SUPPORTED_LANGS.map((lang: Lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => void i18n.changeLanguage(lang)}
              aria-pressed={i18n.language === lang}
              className={`px-3 py-1.5 text-xs font-body transition-colors ${
                i18n.language === lang ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {t(`language.${lang}`)}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * IANA timezone the user reads candle-close (cc) times in. Drives the tz-aware
 * `trades.sessie` mapping (compute_sessie in the DB) — changing it re-buckets all
 * of the user's trades server-side via a trigger, so historical sessions follow.
 */
function TimezoneSettings() {
  const { t } = useTranslation();
  const { profile, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = profile?.timezone ?? "Europe/Brussels";
  const zones = useMemo(() => timezoneOptions(current), [current]);

  async function handleChange(tz: string) {
    if (tz === current) return;
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ timezone: tz });
    } catch (err) {
      setError(toErrorMessage(err, t("settings.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-body text-sm text-ink">{t("settings.timezone")}</p>
          <p className="font-mono text-xs mt-1 text-muted">{t("settings.timezoneDescription")}</p>
        </div>
        <select
          value={current}
          onChange={(e) => void handleChange(e.target.value)}
          disabled={saving}
          className="shrink-0 max-w-[55%] rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold disabled:opacity-50"
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>
      {saving && <p className="font-mono text-[11px] mt-3 text-muted">{t("settings.saving")}</p>}
      {error && <p className="font-mono text-[11px] mt-3 text-loss">{error}</p>}
    </Card>
  );
}

/**
 * Extra waarden bovenop een vaste lijst (bv. "Entry" of "Trade concept") — alleen
 * zichtbaar/bruikbaar voor jezelf, niet voor andere accounts. Generiek over het
 * form-veld: elke categorische lijst met per-user custom_options kan dit hergebruiken.
 */
function CustomFieldOptions({
  field,
  baseList,
  titleKey,
  descriptionKey,
  placeholderKey,
}: {
  field: string;
  baseList: readonly string[];
  titleKey: string;
  descriptionKey: string;
  placeholderKey: string;
}) {
  const { t } = useTranslation();
  const { options, loading, addOption, deleteOption } = useCustomOptions(field);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const existing = new Set([...baseList, ...options.map((o) => o.value)].map((v) => v.toLowerCase()));

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleAdd();
    }
  }

  async function handleAdd() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (existing.has(trimmed.toLowerCase())) {
      setError(t("settings.valueExists"));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addOption(trimmed);
      setValue("");
    } catch (err) {
      setError(toErrorMessage(err, t("settings.addFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <p className="font-body text-sm text-ink">{t(titleKey)}</p>
      <p className="font-mono text-xs mt-1 text-muted">{t(descriptionKey)}</p>

      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t(placeholderKey)}
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving || !value.trim()}
          className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("settings.add")}
        </button>
      </div>
      {error && <p className="font-mono text-[11px] mt-2 text-loss">{error}</p>}

      {!loading && options.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {options.map((o) => (
            <span
              key={o.id}
              className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border border-border-soft font-mono text-xs text-ink"
            >
              {o.value}
              <button
                type="button"
                onClick={() => void deleteOption(o.id)}
                className="p-0.5 rounded-full hover:bg-ink/5 text-muted hover:text-loss"
                aria-label={t("settings.removeOption", { value: o.value })}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
