import { useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useAuth } from "@/hooks/useAuth";
import { useCustomOptions } from "@/hooks/useCustomOptions";
import { ENTRIES, TRADE_CONCEPTS } from "@/lib/constants";
import { toErrorMessage } from "@/lib/errorMessage";
import { SUPPORTED_LANGS, type Lang } from "@/i18n";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { hideFase, updateProfile } = useAuth();
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
        </section>

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
      </div>
    </>
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

/** Full IANA timezone list from the runtime, with the reference default guaranteed present. */
function useTimezoneOptions(current: string): string[] {
  return useMemo(() => {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    const zones = intl.supportedValuesOf?.("timeZone") ?? [
      "UTC",
      "Europe/Brussels",
      "Europe/London",
      "Africa/Johannesburg",
      "America/New_York",
    ];
    // The stored value (and the reference default) must always be selectable.
    const extras = ["Europe/Brussels", current].filter((z) => !zones.includes(z));
    return extras.length ? [...extras, ...zones] : zones;
  }, [current]);
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
  const zones = useTimezoneOptions(current);

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
