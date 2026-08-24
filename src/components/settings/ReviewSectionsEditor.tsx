import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, Pencil, Trash2, X, Check, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useReviewSectionsEditor, type ReviewSectionInput } from "@/hooks/useReviewSectionsEditor";
import { allDefaultSections, reviewSectionLabel, slugifySectionKey } from "@/lib/reviewSections";
import type { ReviewKind, ReviewSectionInputType, ReviewSectionRow } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";

const KINDS: ReviewKind[] = ["weekly", "periodic"];
const INPUT_TYPES: ReviewSectionInputType[] = ["text", "list"];

/**
 * Editor for the active journal's configurable review sections (Fase N5). A
 * journal starts on the built-in defaults (shown read-only); "customize" turns
 * them into editable rows the user can rename, reorder, add to and remove. Mirrors
 * MethodologyEditor for trade fields; a system template forks on first edit.
 */
export function ReviewSectionsEditor() {
  const { t } = useTranslation();
  const editor = useReviewSectionsEditor();
  const { methodology, isOwn, loading, error, fork } = editor;
  const [kind, setKind] = useState<ReviewKind>("weekly");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setActionError(toErrorMessage(err, t("reviewSections.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="font-mono text-xs text-muted">{t("common.loading")}</p>
      </Card>
    );
  }
  if (!methodology) {
    return (
      <Card>
        <p className="font-mono text-xs text-muted">{t("methodology.none")}</p>
      </Card>
    );
  }

  const ownRows = editor.sectionsOf(kind);
  const customized = ownRows.length > 0;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-body text-sm text-ink">{t("reviewSections.title")}</p>
          <p className="font-mono text-xs mt-1 text-muted">{t("reviewSections.description")}</p>
        </div>
        {!isOwn && (
          <button
            type="button"
            onClick={() => void run(fork)}
            disabled={busy}
            className="shrink-0 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40"
          >
            {t("methodology.makeEditable")}
          </button>
        )}
      </div>

      {/* Weekly / periodic switch — each keeps its own section set. */}
      <div className="inline-flex mt-4 rounded-lg border border-border divide-x divide-border overflow-hidden">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`px-3 py-1.5 text-xs font-body transition-colors ${
              kind === k ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            {t(`reviewSections.kind_${k}`)}
          </button>
        ))}
      </div>

      {actionError && <p className="font-mono text-[11px] mt-3 text-loss">{actionError}</p>}
      {error && !actionError && <p className="font-mono text-[11px] mt-3 text-loss">{error}</p>}

      {!customized ? (
        <DefaultPreview
          kind={kind}
          canCustomize={isOwn && !busy}
          onCustomize={() => void run(() => editor.customize(kind))}
        />
      ) : (
        <>
          <div className="flex flex-col divide-y divide-border-soft mt-4 border-t border-border-soft">
            {ownRows.map((s, i) => (
              <SectionRow
                key={s.id}
                section={s}
                editable={isOwn && !busy}
                isFirst={i === 0}
                isLast={i === ownRows.length - 1}
                onMove={(dir) => void run(() => editor.moveSection(s.id, dir))}
                onDelete={() => void run(() => editor.deleteSection(s.id))}
                onSave={(patch) => run(() => editor.updateSection(s.id, patch))}
              />
            ))}
          </div>

          {isOwn && (
            <div className="flex items-center gap-3 flex-wrap mt-4">
              <AddSectionForm
                busy={busy}
                usedKeys={editor.usedKeys(kind)}
                onAdd={(input) => run(() => editor.addSection(kind, input))}
              />
              <button
                type="button"
                onClick={() => void run(() => editor.resetToDefaults(kind))}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs font-body text-muted hover:text-loss disabled:opacity-40"
              >
                <RotateCcw size={13} /> {t("reviewSections.reset")}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function typeLabel(t: (k: string) => string, type: ReviewSectionInputType): string {
  return t(`reviewSections.type_${type}`);
}

/** Read-only preview of the built-in default set with an opt-in to customize. */
function DefaultPreview({ kind, canCustomize, onCustomize }: { kind: ReviewKind; canCustomize: boolean; onCustomize: () => void }) {
  const { t } = useTranslation();
  const defaults = allDefaultSections(kind);
  return (
    <div className="mt-4 border-t border-border-soft pt-4">
      <p className="font-mono text-[11px] text-muted mb-3">{t("reviewSections.usingDefaults")}</p>
      <div className="flex flex-wrap gap-1.5">
        {defaults.map((s) => (
          <span key={s.key} className="px-2.5 py-1 rounded-full border border-border-soft font-mono text-[11px] text-muted">
            {reviewSectionLabel(t, s)}
          </span>
        ))}
      </div>
      {canCustomize && (
        <button
          type="button"
          onClick={onCustomize}
          className="mt-4 px-4 py-2 rounded-lg font-body text-sm font-medium border border-border text-ink hover:border-gold"
        >
          {t("reviewSections.customize")}
        </button>
      )}
    </div>
  );
}

function SectionRow({
  section,
  editable,
  isFirst,
  isLast,
  onMove,
  onDelete,
  onSave,
}: {
  section: ReviewSectionRow;
  editable: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
  onSave: (patch: Partial<ReviewSectionInput>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <SectionForm
        initial={section}
        submitLabel={t("methodology.save")}
        onCancel={() => setEditing(false)}
        onSubmit={async (input) => {
          const displayLabel = reviewSectionLabel(t, section);
          await onSave({
            // Only send label when it actually changed vs the shown text, so an
            // untouched default keeps its catalogue translation (updateSection
            // clears label_key on any label write).
            ...(input.label !== displayLabel ? { label: input.label } : {}),
            input_type: input.input_type,
          });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-body text-sm text-ink truncate">{reviewSectionLabel(t, section)}</p>
        <p className="font-mono text-[11px] mt-0.5 text-muted truncate">
          {section.section_key} · {typeLabel(t, section.input_type)}
        </p>
      </div>
      {editable && (
        <div className="flex items-center gap-0.5 shrink-0 text-muted">
          <IconBtn label={t("methodology.moveUp")} disabled={isFirst} onClick={() => onMove("up")}>
            <ChevronUp size={15} />
          </IconBtn>
          <IconBtn label={t("methodology.moveDown")} disabled={isLast} onClick={() => onMove("down")}>
            <ChevronDown size={15} />
          </IconBtn>
          <IconBtn label={t("methodology.edit")} onClick={() => setEditing(true)}>
            <Pencil size={14} />
          </IconBtn>
          <IconBtn label={t("methodology.delete")} danger onClick={onDelete}>
            <Trash2 size={14} />
          </IconBtn>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, danger }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`p-1.5 rounded-md hover:bg-ink/5 disabled:opacity-30 disabled:cursor-not-allowed ${danger ? "hover:text-loss" : "hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function AddSectionForm({ busy, usedKeys, onAdd }: { busy: boolean; usedKeys: Set<string>; onAdd: (input: Pick<ReviewSectionInput, "label" | "input_type">) => Promise<void> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="px-4 py-2 rounded-lg font-body text-sm font-medium border border-border text-ink hover:border-gold disabled:opacity-40"
      >
        + {t("reviewSections.addSection")}
      </button>
    );
  }

  return (
    <div className="w-full mt-2 pt-4 border-t border-border-soft">
      <SectionForm
        usedKeys={usedKeys}
        submitLabel={t("methodology.add")}
        onCancel={() => setOpen(false)}
        onSubmit={async (input) => {
          await onAdd({ label: input.label, input_type: input.input_type });
          setOpen(false);
        }}
      />
    </div>
  );
}

/** Shared add/edit form: a label plus the text/list type. section_key is derived from the label for new sections, immutable for existing ones. */
function SectionForm({
  initial,
  usedKeys,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ReviewSectionRow;
  usedKeys?: Set<string>;
  submitLabel: string;
  onSubmit: (input: ReviewSectionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isNew = !initial;
  const [label, setLabel] = useState(initial ? reviewSectionLabel(t, initial) : "");
  const [inputType, setInputType] = useState<ReviewSectionInputType>(initial?.input_type ?? "text");
  const [saving, setSaving] = useState(false);

  const duplicateKey = isNew && label.trim().length > 0 && (usedKeys?.has(slugifySectionKey(label)) ?? false);
  const canSave = label.trim().length > 0 && !duplicateKey;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        section_key: initial?.section_key ?? slugifySectionKey(label),
        label: label.trim(),
        label_key: null,
        input_type: inputType,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 py-2 w-full">
      <div className="flex flex-col gap-1">
        <label className="font-mono text-[11px] text-muted">{t("reviewSections.sectionLabel")}</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("reviewSections.labelPlaceholder")}
          className="input"
          autoFocus
        />
        {isNew && label.trim() && <p className="font-mono text-[10px] text-muted">{t("methodology.keyPreview")}: {slugifySectionKey(label)}</p>}
        {duplicateKey && <p className="font-mono text-[10px] text-loss">{t("reviewSections.duplicateKey")}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-[11px] text-muted">{t("reviewSections.sectionType")}</label>
        <select
          value={inputType}
          onChange={(e) => setInputType(e.target.value as ReviewSectionInputType)}
          className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold self-start"
        >
          {INPUT_TYPES.map((it) => (
            <option key={it} value={it}>
              {typeLabel(t, it)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40"
        >
          <Check size={15} /> {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-body text-sm font-medium border border-border text-muted hover:text-ink"
        >
          <X size={15} /> {t("methodology.cancel")}
        </button>
      </div>
    </div>
  );
}
