import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useMethodology } from "@/hooks/useMethodology";
import { normalizeInstrument } from "@/lib/instruments";
import { toErrorMessage } from "@/lib/errorMessage";

/**
 * Curate the active journal's instrument universe (cyclus D). The same
 * normalized list feeds the trade-form instrument select, so a symbol curated
 * here is what the user picks per trade — keeping Per-Instrument breakdowns from
 * fragmenting on typos. Only meaningful for the user's own, non-forex journal: a
 * forex journal picks from the fixed pair enum, and a system template is
 * read-only until forked (the field editor above offers "make editable").
 */
export function JournalInstruments() {
  const { t } = useTranslation();
  const { instruments, addInstrument, removeInstrument, isOwnMethodology, isForexJournal, loading } =
    useMethodology();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Forex journals use the pair enum, not a curated list; a read-only template
  // can't be edited. Render nothing rather than a dead card.
  if (loading || isForexJournal || !isOwnMethodology) return null;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleAdd();
    }
  }

  async function handleAdd() {
    const norm = normalizeInstrument(value);
    if (!norm) return;
    if (instruments.includes(norm)) {
      setError(t("settings.valueExists"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await addInstrument(norm);
      setValue("");
    } catch (err) {
      setError(toErrorMessage(err, t("settings.addFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(symbol: string) {
    setError(null);
    try {
      await removeInstrument(symbol);
    } catch (err) {
      setError(toErrorMessage(err, t("settings.saveFailed")));
    }
  }

  return (
    <Card>
      <p className="font-body text-sm text-ink">{t("settings.instruments")}</p>
      <p className="font-mono text-xs mt-1 text-muted">{t("settings.instrumentsDescription")}</p>

      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("tradeForm.instrumentPlaceholder")}
          autoComplete="off"
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || !value.trim()}
          className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("settings.add")}
        </button>
      </div>
      {error && <p className="font-mono text-[11px] mt-2 text-loss">{error}</p>}

      {instruments.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-4">
          {instruments.map((symbol) => (
            <span
              key={symbol}
              className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border border-border-soft font-mono text-xs text-ink"
            >
              {symbol}
              <button
                type="button"
                onClick={() => void handleRemove(symbol)}
                className="p-0.5 rounded-full hover:bg-ink/5 text-muted hover:text-loss"
                aria-label={t("settings.removeOption", { value: symbol })}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="font-mono text-[11px] mt-4 text-muted">{t("settings.instrumentsEmpty")}</p>
      )}
    </Card>
  );
}
