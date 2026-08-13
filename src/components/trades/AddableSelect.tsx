import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import type { CustomOption } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";

const ADD_SENTINEL = "__add_own_option__";

interface AddableSelectProps {
  /** The shared fixed list (constants.ts). */
  baseOptions: readonly string[];
  /** This user's own extra values for the field (custom_options rows). */
  customOptions: CustomOption[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Persists a new own option (useCustomOptions.addOption); the new value gets selected. */
  onAdd: (value: string) => Promise<CustomOption>;
  /** Deletes one of the user's own options (never a base option). */
  onDeleteOption: (id: string) => Promise<void>;
}

/**
 * Select over a fixed list + the user's own custom_options, with "+ eigen optie…"
 * in the dropdown itself (same move as InstrumentSelect's add-sentinel). Picking
 * it flips to an inline input; while adding, the user's own options are shown as
 * chips with × so pruning them doesn't require a trip to Settings. Base options
 * are shared constants and can't be removed per-user — only own values get a ×.
 * A stored value that's no longer in any list (e.g. an old trade's deleted
 * option) stays visible and selected, so editing never silently drops it.
 */
export function AddableSelect({ baseOptions, customOptions, value, onChange, onAdd, onDeleteOption }: AddableSelectProps) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = [...baseOptions, ...customOptions.map((o) => o.value)];
  const showsCurrent = value != null && value !== "" && !all.includes(value);

  function close() {
    setAdding(false);
    setDraft("");
    setError(null);
  }

  async function commitAdd() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (all.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setError(t("settings.valueExists"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await onAdd(trimmed);
      onChange(created.value);
      close();
    } catch (err) {
      setError(toErrorMessage(err, t("settings.addFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function removeOwn(id: string) {
    setError(null);
    setBusy(true);
    try {
      await onDeleteOption(id);
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
                close();
              }
            }}
            placeholder={t("tradeForm.ownOptionPlaceholder")}
            autoComplete="off"
            autoFocus
            className="input flex-1 min-w-0"
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
            onClick={close}
            disabled={busy}
            aria-label={t("methodology.cancel")}
            className="shrink-0 px-3 rounded-lg border border-border text-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        {customOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customOptions.map((o) => (
              <span
                key={o.id}
                className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full border border-border-soft font-mono text-[11px] text-ink"
              >
                {o.value}
                <button
                  type="button"
                  onClick={() => void removeOwn(o.id)}
                  disabled={busy}
                  aria-label={t("settings.removeOption", { value: o.value })}
                  className="p-0.5 rounded-full hover:bg-ink/5 text-muted hover:text-loss"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
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
      {baseOptions.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      {customOptions.map((o) => (
        <option key={o.id} value={o.value}>
          {o.value}
        </option>
      ))}
      <option value={ADD_SENTINEL}>+ {t("tradeForm.addOwnOption")}</option>
    </select>
  );
}
