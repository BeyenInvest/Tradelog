import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutTemplate, ChevronDown, ChevronUp, FilePlus2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { usePresets, type PresetSummary } from "@/hooks/usePresets";
import { toErrorMessage } from "@/lib/errorMessage";

/** How many field labels to preview on a card before "+N more". */
const PREVIEW_FIELDS = 6;

/**
 * "Start from a template" picker (Scope C, cyclus 6). Lists the built-in journal
 * recipes (asset class × trader style) plus a "Blanco" option. Choosing one forks
 * it into an editable own copy and makes it the active journal (usePresets). This
 * is the shared component the future first-run onboarding wizard will reuse for its
 * "blank or preset?" step; for now it lives in /settings so it is reachable and
 * testable today (public signup is still gated off).
 */
export function PresetPicker() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3 min-w-0">
          <LayoutTemplate size={18} className="mt-0.5 shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="font-body text-sm text-ink">{t("presets.title")}</p>
            <p className="font-mono text-xs mt-1 text-muted">{t("presets.subtitle")}</p>
          </div>
        </div>
        {open ? (
          <ChevronUp size={16} className="shrink-0 text-muted" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-muted" />
        )}
      </button>

      {open && (
        <div className="mt-4 border-t border-border-soft pt-4">
          <PresetChooser onApplied={() => setOpen(false)} />
        </div>
      )}
    </Card>
  );
}

/**
 * The template grid + blank option + confirm step, without the collapsible Card
 * wrapper. Extracted so the first-run empty-state (Scope C, fase C onboarding)
 * can drop the picker inline, expanded, without the settings-page chrome.
 * Applying a choice switches the active journal (usePresets → updateProfile),
 * which remounts the journal view downstream; `onApplied` is an optional hook
 * for the settings card to also collapse itself.
 */
export function PresetChooser({ onApplied }: { onApplied?: () => void }) {
  const { t } = useTranslation();
  const { presets, loading, error, applyPreset, createBlank } = usePresets();
  // Which choice is awaiting confirmation: a preset, "blank", or null.
  const [confirming, setConfirming] = useState<PresetSummary | "blank" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function apply() {
    if (!confirming) return;
    setActionError(null);
    setBusy(true);
    try {
      if (confirming === "blank") await createBlank();
      else await applyPreset(confirming.id);
      setConfirming(null);
      onApplied?.();
    } catch (err) {
      setActionError(toErrorMessage(err, t("presets.applyFailed")));
    } finally {
      setBusy(false);
    }
  }

  const confirmName = confirming === "blank" ? t("presets.blankName") : confirming?.naam;

  return (
    <>
      {loading && <p className="font-mono text-xs text-muted">{t("common.loading")}</p>}
      {error && <p className="font-mono text-[11px] text-loss">{error}</p>}

      {/* Confirmation step — applying switches the active journal, so make it explicit. */}
      {confirming ? (
        <div className="flex flex-col gap-3">
          <p className="font-body text-sm text-ink">{t("presets.confirmTitle")}</p>
          <p className="font-mono text-xs text-muted">
            {t("presets.confirmBody", { name: confirmName })}
          </p>
          {actionError && <p className="font-mono text-[11px] text-loss">{actionError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void apply()}
              disabled={busy}
              className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40"
            >
              {busy ? t("common.submitting") : t("presets.apply")}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(null);
                setActionError(null);
              }}
              disabled={busy}
              className="px-4 py-2 rounded-lg font-body text-sm font-medium border border-border text-muted hover:text-ink"
            >
              {t("presets.cancel")}
            </button>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {presets.map((p) => (
              <PresetCard key={p.id} preset={p} onChoose={() => setConfirming(p)} />
            ))}
            {/* Blanco — start from the universal core only. */}
            <button
              type="button"
              onClick={() => setConfirming("blank")}
              className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border p-3 text-left hover:border-gold"
            >
              <div className="flex items-center gap-2">
                <FilePlus2 size={15} className="text-muted" />
                <span className="font-body text-sm text-ink">{t("presets.blankName")}</span>
              </div>
              <p className="font-mono text-[11px] text-muted">{t("presets.blankDesc")}</p>
            </button>
          </div>
        )
      )}
    </>
  );
}

function PresetCard({ preset, onChoose }: { preset: PresetSummary; onChoose: () => void }) {
  const { t } = useTranslation();
  const shown = preset.fieldLabels.slice(0, PREVIEW_FIELDS);
  const extra = preset.fieldLabels.length - shown.length;

  return (
    <button
      type="button"
      onClick={onChoose}
      className="flex flex-col gap-2 rounded-xl border border-border p-3 text-left hover:border-gold"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-body text-sm text-ink truncate">{preset.naam}</span>
        {preset.asset_class && (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted">
            {preset.asset_class}
          </span>
        )}
      </div>
      {shown.length > 0 ? (
        <p className="font-mono text-[11px] text-muted leading-relaxed">
          {shown.join(" · ")}
          {extra > 0 && ` +${extra}`}
        </p>
      ) : (
        <p className="font-mono text-[11px] text-muted italic">{t("presets.noFields")}</p>
      )}
      <span className="mt-0.5 font-mono text-[11px] text-gold">{t("presets.use")} →</span>
    </button>
  );
}
