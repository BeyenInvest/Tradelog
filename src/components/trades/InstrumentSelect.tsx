import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { toErrorMessage } from "@/lib/errorMessage";

const ADD_SENTINEL = "__add_new_instrument__";

interface InstrumentSelectProps {
  /** Curated instrument universe of the active journal (normalized, sorted). */
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  /**
   * Persists a brand-new symbol to the journal's instrument list and returns the
   * normalized value (or null for blank input). The caller then selects it. On a
   * read-only journal this may just echo the normalized value without persisting.
   */
  onAddInstrument: (raw: string) => Promise<string | null>;
}

/**
 * Instrument picker for a non-forex journal (cyclus D). Replaces the old free-text
 * input: the user picks from the journal's curated list, or deliberately adds a
 * new symbol via "+ new instrument…" (normalized to uppercase + trim). Killing the
 * free-typing path is the point — a stray keystroke can no longer land a junk
 * one-letter instrument ("e") that fragments the Per-Instrument breakdown; adding
 * a symbol is now an explicit, normalizing action. A value not in the list (e.g. a
 * legacy trade's instrument) is still shown as a selectable option so editing an
 * old trade never silently drops it.
 */
export function InstrumentSelect({ options, value, onChange, onAddInstrument }: InstrumentSelectProps) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A legacy/off-list value must remain visible and selected — surface it as its own option.
  const showsCurrent = value != null && value !== "" && !options.includes(value);

  async function commitAdd() {
    const raw = draft.trim();
    if (!raw) return;
    setError(null);
    setBusy(true);
    try {
      const norm = await onAddInstrument(raw);
      if (norm) onChange(norm);
      setAdding(false);
      setDraft("");
    } catch (err) {
      setError(toErrorMessage(err, t("settings.addFailed")));
    } finally {
      setBusy(false);
    }
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitAdd();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setAdding(false);
                setDraft("");
                setError(null);
              }
            }}
            placeholder={t("tradeForm.instrumentPlaceholder")}
            autoComplete="off"
            autoFocus
            className="input flex-1"
          />
          <button
            type="button"
            onClick={() => void commitAdd()}
            disabled={busy || !draft.trim()}
            aria-label={t("settings.add")}
            className="shrink-0 px-3 rounded-lg bg-gold text-on-gold disabled:opacity-40"
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setDraft("");
              setError(null);
            }}
            disabled={busy}
            aria-label={t("methodology.cancel")}
            className="shrink-0 px-3 rounded-lg border border-border text-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        {error && <p className="font-mono text-[11px] text-loss">{error}</p>}
      </div>
    );
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === ADD_SENTINEL) {
          setAdding(true);
          return;
        }
        onChange(e.target.value || null);
      }}
      className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
    >
      <option value="">{t("common.selectPlaceholder")}</option>
      {showsCurrent && <option value={value as string}>{value}</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value={ADD_SENTINEL}>+ {t("tradeForm.addInstrument")}</option>
    </select>
  );
}
