import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookMarked, Check, ChevronDown, ChevronUp, Pencil, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { useJournals, type JournalSummary } from "@/hooks/useJournals";
import { ASSET_ORDER, assetLabel, type AssetClass } from "@/lib/fieldBlocks";
import { AssetIcon } from "@/components/settings/JournalBuilder";

/**
 * Grouped "switch journal" overview for Settings (Fase G-rest A4, mockup screen 02).
 * The sidebar JournalSwitcher is a compact quick-switch dropdown; this is the roomy
 * counterpart — the user's own journals grouped by asset-class, each with a short
 * "N fields · N trades" description and an active marker, click to switch, rename
 * inline. Deletion stays in the switcher (one home for the guarded destructive
 * action). Only worth showing with ≥2 journals, so a fresh single-journal account
 * never sees it. No schema change: the description is derived, not stored.
 */
const OTHER = "__other";

export function JournalOverview() {
  const { t } = useTranslation();
  const { journals, activeId, tradeCounts, loading, switchJournal, renameJournal } = useJournals();

  const [open, setOpen] = useState(true);
  const [fieldCounts, setFieldCounts] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Field count per journal — the "N fields" half of the description. Same head-only
  // exact-count pattern the switcher uses for trades, kept local so the always-mounted
  // switcher's hot path stays lean. Refetches when the journal list changes.
  useEffect(() => {
    if (journals.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        journals.map(async (j) => {
          const { count } = await supabase
            .from("methodology_fields")
            .select("*", { count: "exact", head: true })
            .eq("methodology_id", j.id);
          return [j.id, count ?? 0] as const;
        })
      );
      if (!cancelled) setFieldCounts(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [journals]);

  const groups = useMemo(() => {
    const byKey = new Map<string, JournalSummary[]>();
    for (const j of journals) {
      const key =
        j.asset_class && (ASSET_ORDER as string[]).includes(j.asset_class) ? j.asset_class : OTHER;
      const list = byKey.get(key) ?? [];
      list.push(j);
      byKey.set(key, list);
    }
    const ordered: { key: string; label: string; asset: AssetClass | null; items: JournalSummary[] }[] = [];
    for (const a of ASSET_ORDER) {
      const items = byKey.get(a);
      if (items) ordered.push({ key: a, label: assetLabel(t, a), asset: a, items });
    }
    const other = byKey.get(OTHER);
    if (other) ordered.push({ key: OTHER, label: t("journalOverview.otherGroup"), asset: null, items: other });
    return ordered;
  }, [journals, t]);

  // Only earns its place once there's something to switch between.
  if (loading && journals.length === 0) return null;
  if (journals.length <= 1) return null;

  async function choose(id: string) {
    if (id === activeId || busyId) return;
    setError(null);
    setBusyId(id);
    try {
      await switchJournal(id);
    } catch (err) {
      setError(toErrorMessage(err, t("journalSwitcher.switchFailed")));
    } finally {
      setBusyId(null);
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
    setBusyId(id);
    try {
      await renameJournal(id, val);
      setEditingId(null);
    } catch (err) {
      setError(toErrorMessage(err, t("journalSwitcher.renameFailed")));
    } finally {
      setBusyId(null);
    }
  }

  function describe(j: JournalSummary): string {
    const fc = fieldCounts[j.id];
    const tc = tradeCounts[j.id];
    return [
      fc != null ? t("journalOverview.fieldCount", { count: fc }) : null,
      tc != null ? t("journalOverview.tradeCount", { count: tc }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3 min-w-0">
          <BookMarked size={18} className="mt-0.5 shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="font-body text-sm text-ink">{t("journalOverview.title")}</p>
            <p className="font-mono text-xs mt-1 text-muted">{t("journalOverview.subtitle")}</p>
          </div>
        </div>
        {open ? (
          <ChevronUp size={16} className="shrink-0 text-muted" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-muted" />
        )}
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-5 border-t border-border-soft pt-4">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-faint">
                {g.asset && <AssetIcon asset={g.asset} />}
                {g.label}
              </p>
              <div className="flex flex-col gap-2">
                {g.items.map((j) => {
                  const isActive = j.id === activeId;

                  if (editingId === j.id) {
                    return (
                      <div key={j.id} className="flex items-center gap-1 rounded-lg border border-gold/40 bg-bg px-2 py-1.5">
                        <input
                          autoFocus
                          value={editValue}
                          maxLength={80}
                          disabled={busyId === j.id}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveRename();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="input min-w-0 flex-1 py-1 text-sm"
                        />
                        <IconBtn label={t("common.save")} onClick={() => void saveRename()} disabled={busyId === j.id}>
                          <Check size={14} />
                        </IconBtn>
                        <IconBtn label={t("common.cancel")} onClick={() => setEditingId(null)} disabled={busyId === j.id}>
                          <X size={14} />
                        </IconBtn>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={j.id}
                      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        isActive ? "border-gold/50 bg-gold/8" : "border-border bg-bg hover:border-gold/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void choose(j.id)}
                        disabled={isActive || busyId != null}
                        title={isActive ? t("journalOverview.active") : t("journalOverview.switchTo", { name: j.naam })}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default"
                      >
                        <Check size={15} className={`shrink-0 ${isActive ? "text-gold" : "opacity-0"}`} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-body text-sm text-ink">{j.naam}</span>
                            {isActive && (
                              <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-1.5 py-0.5 font-mono text-[10px] text-gold">
                                {t("journalOverview.active")}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">{describe(j)}</span>
                        </span>
                      </button>
                      <IconBtn
                        label={t("journalSwitcher.rename")}
                        onClick={() => startRename(j)}
                        disabled={busyId != null}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Pencil size={13} />
                      </IconBtn>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {error && <p className="font-mono text-[11px] text-loss">{error}</p>}
        </div>
      )}
    </Card>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
