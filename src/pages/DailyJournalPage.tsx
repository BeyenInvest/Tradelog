import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, Trash2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { useDailyJournal } from "@/hooks/useDailyJournal";
import { useConfirm } from "@/hooks/useConfirm";
import { localTodayIso } from "@/lib/localDate";
import { dateLocale } from "@/lib/format";
import { toErrorMessage } from "@/lib/errorMessage";
import type { DailyJournalEntry } from "@/lib/types";
import clsx from "clsx";

/** yyyy-mm-dd → a full local date label, parsed as a LOCAL date (no UTC shift). */
function formatDay(iso: string, locale: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DailyJournalPage() {
  const { t, i18n } = useTranslation();
  const { entries, loading, error, saveEntry, deleteEntry } = useDailyJournal();
  const { confirm, confirmDialog } = useConfirm();

  const today = localTodayIso();
  const [selectedDate, setSelectedDate] = useState(today);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const locale = dateLocale(i18n.language);
  const entryForDate = useMemo(
    () => entries.find((e) => e.entry_date === selectedDate) ?? null,
    [entries, selectedDate]
  );
  const savedContent = entryForDate?.content ?? "";

  // Load the selected day's saved note into the editor. Re-runs when the day
  // changes or when that day's stored content changes (e.g. after a save/refresh),
  // which is a no-op once draft already equals the freshly-saved value.
  useEffect(() => {
    setDraft(savedContent);
    setJustSaved(false);
    setActionError(null);
  }, [selectedDate, savedContent]);

  const dirty = draft !== savedContent;
  const canSave = dirty && draft.trim().length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setActionError(null);
    try {
      await saveEntry(selectedDate, draft);
      setJustSaved(true);
    } catch (err) {
      setActionError(toErrorMessage(err, t("dailyJournal.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: DailyJournalEntry) {
    const ok = await confirm({
      title: t("common.deleteTitle"),
      message: t("dailyJournal.deleteConfirm", { date: formatDay(entry.entry_date, locale) }),
      tone: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    setActionError(null);
    try {
      await deleteEntry(entry.id);
      if (entry.entry_date === selectedDate) setDraft("");
    } catch (err) {
      setActionError(toErrorMessage(err, t("dailyJournal.deleteFailed")));
    }
  }

  return (
    <>
      {confirmDialog}
      <PageHeader title={t("nav.dailyJournal")} subtitle={t("dailyJournal.subtitle")} />

      {error && <p className="text-sm text-loss mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Editor */}
        <Card className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-gold" htmlFor="daily-date">
                {t("dailyJournal.dateLabel")}
              </label>
              <input
                id="daily-date"
                type="date"
                className="input w-auto"
                max={today}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || today)}
              />
            </div>
            <p className="font-display text-lg italic text-ink">
              {formatDay(selectedDate, locale)}
              {selectedDate === today ? <span className="ml-2 text-xs not-italic text-gold">{t("dailyJournal.todayBadge")}</span> : null}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-gold" htmlFor="daily-note">
              {t("dailyJournal.writeLabel")}
            </label>
            <textarea
              id="daily-note"
              rows={10}
              className="input"
              placeholder={t("dailyJournal.placeholder")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>

          {actionError && <p className="text-sm text-loss">{actionError}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={!canSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={15} /> {t("dailyJournal.save")}
            </button>
            {justSaved && !dirty && <span className="text-xs text-win">{t("dailyJournal.saved")}</span>}
            {entryForDate && (
              <button
                onClick={() => void handleDelete(entryForDate)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-body text-sm text-muted hover:text-loss transition-colors ml-auto"
              >
                <Trash2 size={14} /> {t("dailyJournal.delete")}
              </button>
            )}
          </div>

          {/* AI review is planned but not yet built (greenfield — needs an edge function). */}
          <div className="flex items-start gap-2 pt-2 mt-1 border-t border-border text-xs text-muted">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-gold/70" />
            <span>{t("dailyJournal.aiPlanned")}</span>
          </div>
        </Card>

        {/* Past entries */}
        <Card className="flex flex-col gap-2">
          <h3 className="font-display text-xl italic mb-2 px-1 text-ink">{t("dailyJournal.pastHeading")}</h3>
          {loading ? (
            <p className="text-sm text-muted px-1">{t("common.loading")}</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted px-1">{t("dailyJournal.noEntries")}</p>
          ) : (
            entries.map((entry) => {
              const active = entry.entry_date === selectedDate;
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedDate(entry.entry_date)}
                  className={clsx(
                    "text-left rounded-lg p-3 font-body text-sm transition-colors border",
                    active ? "bg-surface-2 border-gold" : "bg-transparent border-transparent hover:bg-surface-2"
                  )}
                >
                  <p className="text-ink capitalize">{formatDay(entry.entry_date, locale)}</p>
                  {entry.content && <p className="text-muted text-xs mt-1 line-clamp-2">{entry.content}</p>}
                </button>
              );
            })
          )}
        </Card>
      </div>
    </>
  );
}
