import { useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Plus, Trash2, Pencil, ChevronUp, ChevronDown, Check, X, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/hooks/useConfirm";
import { toErrorMessage } from "@/lib/errorMessage";
import type { useHabits } from "@/hooks/useHabits";
import type { Habit, HabitInput, HabitTier } from "@/lib/types";

type Draft = { label: string; tier: HabitTier; target: string; is_floor: boolean };

const emptyDraft: Draft = { label: "", tier: "daily", target: "3", is_floor: false };

function toInput(d: Draft): HabitInput {
  return {
    label: d.label.trim(),
    tier: d.tier,
    target: d.tier === "weekly" ? Math.max(1, Math.round(Number(d.target) || 1)) : null,
    is_floor: d.tier === "daily" ? d.is_floor : false,
  };
}

/** The add/edit form for a single habit — shared by "new habit" and the inline row editor. */
function HabitForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  onSubmit: (input: HabitInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = draft.label.trim().length > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(toInput(draft));
      setDraft(emptyDraft);
    } catch (err) {
      setError(toErrorMessage(err, t("habits.builderSaveFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        className="input"
        placeholder={t("habits.builderLabelPlaceholder")}
        value={draft.label}
        maxLength={80}
        onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {/* Tier toggle */}
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface-2">
          {(["daily", "weekly"] as HabitTier[]).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, tier }))}
              className={clsx(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                draft.tier === tier ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              {t(tier === "daily" ? "habits.builderTierDaily" : "habits.builderTierWeekly")}
            </button>
          ))}
        </div>

        {draft.tier === "weekly" && (
          <label className="flex items-center gap-2 text-sm text-muted">
            {t("habits.builderTargetLabel")}
            <input
              type="number"
              min={1}
              max={7}
              className="input w-16"
              value={draft.target}
              onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))}
            />
            <span className="text-xs">{t("habits.builderPerWeek")}</span>
          </label>
        )}

        {draft.tier === "daily" && (
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, is_floor: !d.is_floor }))}
            aria-pressed={draft.is_floor}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors",
              draft.is_floor ? "border-gold/60 bg-gold/10 text-ink" : "border-border text-muted hover:text-ink"
            )}
            title={t("habits.builderFloorHint")}
          >
            <ShieldCheck size={14} className={draft.is_floor ? "text-gold" : "text-muted"} />
            {t("habits.builderFloorToggle")}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!valid || busy}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check size={15} /> {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-ink">
            <X size={14} /> {t("common.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

/** One habit row in the manage list: label + badges, reorder, edit, delete. */
function HabitRow({
  habit,
  isFirst,
  isLast,
  onMove,
  onEdit,
  onDelete,
}: {
  habit: Habit;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-surface-2">
      <div className="flex flex-col shrink-0">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          aria-label={t("habits.builderMoveUp")}
          className="text-muted hover:text-ink disabled:opacity-25 disabled:hover:text-muted -my-0.5"
        >
          <ChevronUp size={15} />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast}
          aria-label={t("habits.builderMoveDown")}
          className="text-muted hover:text-ink disabled:opacity-25 disabled:hover:text-muted -my-0.5"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm text-ink truncate">{habit.label}</span>
        {habit.is_floor && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/30">
            <ShieldCheck size={11} /> {t("habits.builderFloorBadge")}
          </span>
        )}
        {habit.tier === "weekly" && (
          <span className="shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface text-muted border border-border">
            {t("habits.anPerWeek", { count: habit.target ?? 0 })}
          </span>
        )}
      </div>

      <button type="button" onClick={onEdit} aria-label={t("common.edit")} className="p-1.5 rounded-md text-muted hover:text-ink shrink-0">
        <Pencil size={14} />
      </button>
      <button type="button" onClick={onDelete} aria-label={t("common.delete")} className="p-1.5 rounded-md text-muted hover:text-loss shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/** The "manage" tab: build and organise your own habits. Everything lives here — never in Settings. */
export function BuilderView({ h }: { h: ReturnType<typeof useHabits> }) {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { dailyHabits, weeklyHabits, hasHabits, addHabit, updateHabit, deleteHabit, moveHabit } = h;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function handleDelete(habit: Habit) {
    const ok = await confirm({
      title: t("habits.builderDeleteTitle"),
      message: t("habits.builderDeleteConfirm", { label: habit.label }),
      tone: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    setRowError(null);
    try {
      await deleteHabit(habit.id);
    } catch (err) {
      setRowError(toErrorMessage(err, t("habits.builderDeleteFailed")));
    }
  }

  function renderGroup(title: string, list: Habit[]) {
    if (list.length === 0) return null;
    return (
      <div className="flex flex-col gap-2">
        <p className="font-body text-xs uppercase tracking-wider text-muted">{title}</p>
        <div className="flex flex-col gap-2">
          {list.map((habit, i) =>
            editingId === habit.id ? (
              <Card key={habit.id} padding="sm" className="bg-surface-2">
                <HabitForm
                  initial={{
                    label: habit.label,
                    tier: habit.tier,
                    target: String(habit.target ?? 3),
                    is_floor: habit.is_floor,
                  }}
                  submitLabel={t("common.save")}
                  onSubmit={async (input) => {
                    await updateHabit(habit.id, input);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </Card>
            ) : (
              <HabitRow
                key={habit.id}
                habit={habit}
                isFirst={i === 0}
                isLast={i === list.length - 1}
                onMove={(dir) => void moveHabit(habit.id, dir)}
                onEdit={() => setEditingId(habit.id)}
                onDelete={() => void handleDelete(habit)}
              />
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {confirmDialog}

      {!hasHabits && (
        <Card className="flex flex-col items-center text-center gap-2 py-8">
          <h2 className="font-display text-2xl italic text-ink">{t("habits.builderEmptyTitle")}</h2>
          <p className="text-sm text-muted max-w-md">{t("habits.builderEmptyBody")}</p>
        </Card>
      )}

      {hasHabits && (
        <div className="flex flex-col gap-5">
          {renderGroup(t("habits.builderTierDaily"), dailyHabits)}
          {renderGroup(t("habits.builderTierWeekly"), weeklyHabits)}
          {rowError && <p className="text-sm text-loss">{rowError}</p>}
        </div>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Plus size={16} className="text-gold" />
          <h3 className="font-display text-lg italic text-ink">{t("habits.builderAddTitle")}</h3>
        </div>
        <HabitForm initial={emptyDraft} submitLabel={t("habits.builderAdd")} onSubmit={addHabit} />
      </Card>
    </div>
  );
}
