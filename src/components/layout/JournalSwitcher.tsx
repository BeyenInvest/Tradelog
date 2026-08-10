import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronsUpDown, Check, Plus, BookMarked } from "lucide-react";
import { useJournals } from "@/hooks/useJournals";
import { useClickOutside } from "@/hooks/useClickOutside";
import { toErrorMessage } from "@/lib/errorMessage";

/**
 * Active-journal picker at the top of the sidebar (cyclus 3b). Lists the user's
 * own journals, switches between them, and offers "+ new journal" (which routes to
 * /settings where the PresetPicker forks/creates one). Everything journal-scoped
 * — trades, analysis, reviews, accounts — re-scopes the moment the active journal
 * changes. Hidden until at least one journal loads so it never flashes empty.
 */
export function JournalSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { journals, activeId, loading, switchJournal } = useJournals();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  // The active journal is normally one of the user's own; fall back gracefully if
  // the profile still points at something not in the list (e.g. a system template).
  const active = journals.find((j) => j.id === activeId) ?? null;
  const activeName = active?.naam ?? t("journalSwitcher.unknown");

  async function choose(id: string) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await switchJournal(id);
      setOpen(false);
    } catch (err) {
      setError(toErrorMessage(err, t("journalSwitcher.switchFailed")));
    } finally {
      setBusy(false);
    }
  }

  // Don't render an empty shell before the first load resolves.
  if (loading && journals.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("journalSwitcher.label")}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-left"
      >
        <BookMarked size={15} className="shrink-0 text-gold" />
        <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">{activeName}</span>
        <ChevronsUpDown size={14} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {journals.map((j) => (
            <button
              key={j.id}
              type="button"
              role="option"
              aria-selected={j.id === activeId}
              disabled={busy}
              onClick={() => void choose(j.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-2 disabled:opacity-50"
            >
              <Check size={14} className={`shrink-0 ${j.id === activeId ? "text-gold" : "opacity-0"}`} />
              <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">{j.naam}</span>
              {j.asset_class && (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted">{j.asset_class}</span>
              )}
            </button>
          ))}
          <div className="my-1 border-t border-border-soft" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
          >
            <Plus size={14} className="shrink-0 text-muted" />
            <span className="font-body text-sm text-muted">{t("journalSwitcher.newJournal")}</span>
          </button>
        </div>
      )}
      {error && <p className="mt-1 font-mono text-[10px] text-loss">{error}</p>}
    </div>
  );
}
