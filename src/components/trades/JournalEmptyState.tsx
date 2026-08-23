import { useTranslation } from "react-i18next";
import { Plus, Upload, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { JournalBuilder } from "@/components/settings/JournalBuilder";

interface JournalEmptyStateProps {
  /**
   * True when the active journal already has custom fields configured (a preset
   * or a hand-built recipe). Drives which variant we show: a fresh blank journal
   * (no fields) gets the full "pick a template or start blank" onboarding with the
   * preset picker inline; a configured-but-empty journal only needs the nudge to
   * log its first trade.
   */
  hasFields: boolean;
  /**
   * Whether to offer the template picker. Gated on beta_features upstream — the
   * multi-journal / preset UI is soft-launched, and a non-beta (legacy WPM) user
   * always has fields anyway, so in practice only beta users reach the no-fields
   * variant. Kept as an explicit prop so the gate lives in one place.
   */
  showPresetPicker: boolean;
  /** Import is Beta — the CTA follows the same beta_features gate as the header button. */
  showImport: boolean;
  onNewTrade: () => void;
  onImport: () => void;
}

/**
 * First-run onboarding for the live Journal (Scope C, fase C). Replaces the KPI
 * row + empty charts + "0 trades" calendar that a brand-new account would
 * otherwise stare at, with a clear next step — so a stranger knows what to do
 * within 30 seconds without hunting through Settings for the preset picker.
 *
 * Never shown for a backtest project (JournalPage passes it only for the live
 * scope) and never once the journal has at least one trade.
 */
export function JournalEmptyState({ hasFields, showPresetPicker, showImport, onNewTrade, onImport }: JournalEmptyStateProps) {
  const { t } = useTranslation();

  // A journal that still has to be shaped (no fields yet) and the picker is
  // available → lead with "choose a recipe or start blank".
  const showTemplateStep = !hasFields && showPresetPicker;

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
          <Sparkles size={22} className="text-gold" />
        </div>
        <div className="flex flex-col gap-1.5 max-w-md">
          <h2 className="font-display text-2xl italic text-ink">{t("journalEmpty.title")}</h2>
          <p className="font-body text-sm text-muted">
            {showTemplateStep ? t("journalEmpty.bodyTemplate") : t("journalEmpty.bodyConfigured")}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={onNewTrade}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
          >
            <Plus size={15} /> {t("journalEmpty.logFirstTrade")}
          </button>
          {showImport && (
            <button
              onClick={onImport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-surface-2 text-ink hover:bg-ink/5"
            >
              <Upload size={15} /> {t("journalEmpty.importHint")}
            </button>
          )}
        </div>
      </Card>

      {showTemplateStep && (
        <Card className="flex flex-col gap-4">
          <div>
            <h3 className="font-display text-lg text-ink">{t("builder.newJournal")}</h3>
            <p className="font-mono text-xs mt-1 text-muted">{t("builder.overviewSubtitle")}</p>
          </div>
          <div className="border-t border-border-soft pt-4">
            <JournalBuilder reuseActiveIfEmpty />
          </div>
        </Card>
      )}
    </div>
  );
}
