import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronsUpDown, Check, Plus, BookMarked, Pencil, Trash2, X } from "lucide-react";
import { useJournals, type JournalSummary, type JournalCounts } from "@/hooks/useJournals";
import { useClickOutside } from "@/hooks/useClickOutside";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toErrorMessage } from "@/lib/errorMessage";

/**
 * Active-journal picker at the top of the sidebar (cyclus 3b) + inline journal
 * management (fase B). Lists the user's own journals with a live trade count so
 * two same-named books are distinguishable, switches between them, renames them
 * inline, deletes empty ones (guarded), and offers "+ new journal" (routing to
 * /settings where the PresetPicker forks/creates one). Everything journal-scoped
 * re-scopes the moment the active journal changes. Hidden until at least one
 * journal loads so it never flashes empty. `compact` is the mobile top-bar variant.
 */
export function JournalSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { journals, activeId, tradeCounts, loading, switchJournal, renameJournal, deleteJournal, fetchCounts } =
    useJournals();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleting, setDeleting] = useState<JournalSummary | null>(null);
  const [deleteCounts, setDeleteCounts] = useState<JournalCounts | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(
    ref,
    () => {
      setOpen(false);
      setEditingId(null);
    },
    open
  );

  // The active journal is normally one of the user's own; fall back gracefully if
  // the profile still points at something not in the list (e.g. a system template).
  const active = journals.find((j) => j.id === activeId) ?? null;
  const activeName = active?.naam ?? t("journalSwitcher.unknown");

  // Load the deleting journal's counts on demand — drives the empty-vs-blocked message.
  useEffect(() => {
    if (!deleting) return;
    let cancelled = false;
    setDeleteCounts(null);
    setDeleteError(null);
    fetchCounts(deleting.id)
      .then((c) => !cancelled && setDeleteCounts(c))
      .catch((err) => !cancelled && setDeleteError(toErrorMessage(err, t("journalSwitcher.deleteFailed"))));
    return () => {
      cancelled = true;
    };
  }, [deleting, fetchCounts, t]);

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

  function startRename(j: JournalSummary) {
    setError(null);
    setEditingId(j.id);
    setEditValue(j.naam);
  }

  async function saveRename() {
    const id = editingId;
    const val = editValue.trim();
    if (!id) return;
    if (!val) {
      setEditingId(null); // blank = cancel, never persist an empty name
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await renameJournal(id, val);
      setEditingId(null);
    } catch (err) {
      setError(toErrorMessage(err, t("journalSwitcher.renameFailed")));
    } finally {
      setBusy(false);
    }
  }

  function startDelete(j: JournalSummary) {
    setOpen(false);
    setDeleting(j);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    setBusy(true);
    try {
      await deleteJournal(deleting.id);
      setDeleting(null);
    } catch (err) {
      setDeleteError(toErrorMessage(err, t("journalSwitcher.deleteFailed")));
    } finally {
      setBusy(false);
    }
  }

  // Don't render an empty shell before the first load resolves.
  if (loading && journals.length === 0) return null;

  const hasContents =
    deleteCounts != null && (deleteCounts.trades > 0 || deleteCounts.reviews > 0 || deleteCounts.accounts > 0);
  // Confirm stays inert until counts resolve (null = loading/errored) and while the journal still holds data.
  const confirmDisabled = deleteCounts == null || hasContents;
  const deleteMessage = !deleting
    ? ""
    : deleteCounts == null
      ? t("journalSwitcher.checkingContents")
      : hasContents
        ? t("journalSwitcher.deleteBlocked", { name: deleting.naam })
        : t("journalSwitcher.deleteConfirm", { name: deleting.naam });

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
          className={`absolute left-0 top-full z-30 mt-1 rounded-lg border border-border bg-surface p-1 shadow-lg ${
            compact ? "min-w-[16rem]" : "right-0"
          }`}
        >
          {journals.map((j) => {
            const isActive = j.id === activeId;
            const count = tradeCounts[j.id];
            const deleteDisabled = isActive || journals.length <= 1;
            const deleteTitle = isActive
              ? t("journalSwitcher.cannotDeleteActive")
              : journals.length <= 1
                ? t("journalSwitcher.cannotDeleteLast")
                : t("journalSwitcher.delete");

            if (editingId === j.id) {
              return (
                <div key={j.id} className="flex items-center gap-1 px-1 py-1">
                  <input
                    autoFocus
                    value={editValue}
                    disabled={busy}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="input min-w-0 flex-1 py-1 text-sm"
                  />
                  <IconBtn label={t("common.save")} onClick={() => void saveRename()} disabled={busy}>
                    <Check size={14} />
                  </IconBtn>
                  <IconBtn label={t("common.cancel")} onClick={() => setEditingId(null)} disabled={busy}>
                    <X size={14} />
                  </IconBtn>
                </div>
              );
            }

            return (
              <div key={j.id} className="group flex items-center rounded-md hover:bg-surface-2">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={busy}
                  onClick={() => void choose(j.id)}
                  title={j.naam}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left disabled:opacity-50"
                >
                  <Check size={14} className={`shrink-0 ${isActive ? "text-gold" : "opacity-0"}`} />
                  <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">{j.naam}</span>
                  {count != null && (
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      · {t("journalSwitcher.countTrades", { count })}
                    </span>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-0.5 pr-1 text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <IconBtn label={t("journalSwitcher.rename")} onClick={() => startRename(j)} disabled={busy}>
                    <Pencil size={13} />
                  </IconBtn>
                  <IconBtn
                    label={deleteTitle}
                    onClick={() => startDelete(j)}
                    disabled={busy || deleteDisabled}
                    danger
                  >
                    <Trash2 size={13} />
                  </IconBtn>
                </div>
              </div>
            );
          })}
          <div className="my-1 border-t border-border-soft" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              // Route state makes Settings auto-open + scroll to the preset
              // picker, so "new journal" is one click, not a hunt through Settings.
              navigate("/settings", { state: { openPresets: true } });
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
          >
            <Plus size={14} className="shrink-0 text-muted" />
            <span className="font-body text-sm text-muted">{t("journalSwitcher.newJournal")}</span>
          </button>
        </div>
      )}
      {error && <p className="mt-1 font-mono text-[10px] text-loss">{error}</p>}

      {deleting && (
        <ConfirmDialog
          title={t("journalSwitcher.deleteTitle")}
          message={deleteMessage}
          confirmLabel={t("common.delete")}
          tone="danger"
          confirmDisabled={confirmDisabled || busy}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          {hasContents && deleteCounts && (
            <ul className="flex flex-col gap-1 font-mono text-xs text-muted">
              {deleteCounts.trades > 0 && <li>· {t("journalSwitcher.countTrades", { count: deleteCounts.trades })}</li>}
              {deleteCounts.reviews > 0 && <li>· {t("journalSwitcher.countReviews", { count: deleteCounts.reviews })}</li>}
              {deleteCounts.accounts > 0 && (
                <li>· {t("journalSwitcher.countAccounts", { count: deleteCounts.accounts })}</li>
              )}
            </ul>
          )}
          {deleteError && <p className="font-mono text-[11px] text-loss">{deleteError}</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-1.5 hover:bg-ink/5 disabled:opacity-30 disabled:cursor-not-allowed ${
        danger ? "hover:text-loss" : "hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
