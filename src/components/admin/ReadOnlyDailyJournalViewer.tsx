import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { dateLocale } from "@/lib/format";
import type { DailyJournalEntry } from "@/lib/types";

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

/**
 * Read-only dagboek viewer for the admin debug page (mirrors DailyJournalPage's
 * list, without the editor). Entries arrive newest-first from getDailyJournalForUser;
 * the admin only reads. Global per user, so this is the person's whole dagboek
 * regardless of active journal.
 */
export function ReadOnlyDailyJournalViewer({ entries }: { entries: DailyJournalEntry[] }) {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? entries[0] ?? null,
    [entries, selectedId]
  );

  if (entries.length === 0) {
    return (
      <Card className="flex items-center justify-center py-12">
        <p className="text-sm text-muted">{t("admin.dailyNoEntries")}</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Selected entry */}
      <Card className="lg:col-span-2 flex flex-col gap-3">
        {selected && (
          <>
            <p className="font-display text-lg italic text-ink capitalize">{formatDay(selected.entry_date, locale)}</p>
            <p className="font-body text-sm text-ink whitespace-pre-wrap">{selected.content}</p>
          </>
        )}
      </Card>

      {/* Entry list */}
      <Card className="flex flex-col gap-2">
        <h3 className="font-display text-xl italic mb-2 px-1 text-ink">
          {t("admin.dailyEntriesHeading", { count: entries.length })}
        </h3>
        {entries.map((entry) => {
          const active = entry.id === (selected?.id ?? null);
          return (
            <button
              key={entry.id}
              onClick={() => setSelectedId(entry.id)}
              className={clsx(
                "text-left rounded-lg p-3 font-body text-sm transition-colors border",
                active ? "bg-surface-2 border-gold" : "bg-transparent border-transparent hover:bg-surface-2"
              )}
            >
              <p className="text-ink capitalize">{formatDay(entry.entry_date, locale)}</p>
              {entry.content && <p className="text-muted text-xs mt-1 line-clamp-2">{entry.content}</p>}
            </button>
          );
        })}
      </Card>
    </div>
  );
}
