import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LineChart } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useMethodology } from "@/hooks/useMethodology";
import { toErrorMessage } from "@/lib/errorMessage";

/**
 * Per-journal opt-in for the advanced-analysis layer (Fase G-rest, 0050). Turns on
 * the planned R:R + MAE/MFE fields in the trade form, the exit-analysis section in
 * the Analyse tab, and the SQN KPI card — all keyed to the active journal's
 * `track_exit`. The journal builder offers the same switch for a fresh journal;
 * this card is how you flip it on an existing one. Own journals only (a read-only
 * template can't store the flag), so it hides on a system template.
 */
export function AdvancedAnalysisSettings() {
  const { t } = useTranslation();
  const { trackExit, setTrackExit, isOwnMethodology, loading } = useMethodology();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || !isOwnMethodology) return null;

  async function handleChange(value: boolean) {
    setError(null);
    setSaving(true);
    try {
      await setTrackExit(value);
    } catch (err) {
      setError(toErrorMessage(err, t("settings.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <LineChart size={18} className="mt-0.5 shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="font-body text-sm text-ink">{t("builder.advancedAnalysis")}</p>
            <p className="font-mono text-xs mt-1 text-muted">{t("advancedAnalysis.description")}</p>
          </div>
        </div>
        <BooleanToggle value={trackExit} onChange={(v) => void handleChange(v)} labels={[t("settings.on"), t("settings.off")]} />
      </div>
      {saving && <p className="font-mono text-[11px] mt-3 text-muted">{t("settings.saving")}</p>}
      {error && <p className="font-mono text-[11px] mt-3 text-loss">{error}</p>}
    </Card>
  );
}
