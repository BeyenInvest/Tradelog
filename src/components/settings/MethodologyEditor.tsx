import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ChevronUp, ChevronDown, Pencil, Trash2, X, Check, Plus, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useMethodologyEditor, type FieldInput } from "@/hooks/useMethodologyEditor";
import { slugifyFieldKey } from "@/lib/methodologyFields";
import { fieldGroupLabel, fieldLabel } from "@/lib/fieldBlocks";
import type { MethodologyField } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";
import { MethodologyPreview } from "./MethodologyPreview";

/** A pickable section in the field editor's group dropdown — the raw stored
 *  group_key/group_label pair (sent verbatim so the clear-stale-keys trigger never
 *  fires), with a translated label just for display. */
interface SectionOption {
  id: string;
  group_key: string | null;
  group_label: string | null;
  display: string;
}

/** Distinct sections present across the methodology's fields, in first-seen order.
 *  Built from raw group_key/group_label so selecting one re-attaches a field to the
 *  exact same bucket (no translation drift, no orphaned label-only "Setup"). */
function collectSections(fields: MethodologyField[], t: TFunction): SectionOption[] {
  const out: SectionOption[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    if (f.group_key == null && f.group_label == null) continue; // ungrouped
    const id = f.group_key ?? `label:${f.group_label}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, group_key: f.group_key, group_label: f.group_label, display: fieldGroupLabel(t, f) ?? f.group_label ?? "" });
  }
  return out;
}

const FIELD_TYPES: MethodologyField["field_type"][] = ["boolean", "enum", "text", "number", "date"];

/** The config-group keys that render inside the trade form's "Technical analysis"
 *  section (setup/markt/mindset). Everything else falls to "Extra velden". */
const WOVEN_KEYS: readonly string[] = ["setup", "markt", "mindset"];

/**
 * The trade form's built-in (non-config) fields per section — shown greyed in the
 * editor as read-only context so the field list mirrors the real form top-to-bottom
 * (owner 2026-09-22). Labels reuse the form's own i18n keys; the set is the common
 * one (the opt-in MAE/MFE/exit rows are left out to avoid noise).
 */
function nativeFields(
  t: TFunction,
  isWpm: boolean,
  hasCc: boolean
): { entry: string[]; result: string[]; screenshots: string[]; notes: string } {
  return {
    // The form shows the open time unless a `cc` field takes its slot (EntrySection).
    entry: hasCc
      ? [t("tradeForm.datumOpen"), t("tradeForm.pair"), t("tradeForm.direction")]
      : [t("tradeForm.datumOpen"), t("tradeForm.tijdOpen"), t("tradeForm.pair"), t("tradeForm.direction")],
    result: [
      t("tradeForm.tradeStatus"),
      t("tradeForm.outcome"),
      t("tradeForm.tradeEvaluation"),
      t("tradeForm.resultPct"),
      t("tradeForm.datumSluiting"),
      t("tradeForm.plannedRisk"),
      t("tradeForm.durationDerived"),
    ],
    // Default screenshot-slot names; the user can override them (0060).
    screenshots: [
      t(isWpm ? "tradeForm.weeklyScreenshot" : "tradeForm.screenshot1"),
      t(isWpm ? "tradeForm.dailyScreenshot" : "tradeForm.screenshot2"),
      t(isWpm ? "tradeForm.h4Screenshot" : "tradeForm.screenshot3"),
      t(isWpm ? "tradeForm.h2Screenshot" : "tradeForm.screenshot4"),
    ],
    notes: t("tradeForm.notes"),
  };
}

/**
 * Editable per-slot screenshot names (0060). Four inputs; an empty one falls back to
 * the built-in default (shown as the placeholder). Saves the whole array on blur —
 * the preview and real form pick the names up via refreshShared.
 */
function ScreenshotLabelsEditor({
  defaults,
  value,
  onSave,
}: {
  defaults: string[];
  value: string[] | null;
  onSave: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const [labels, setLabels] = useState<string[]>(() => defaults.map((_, i) => value?.[i] ?? ""));

  const commit = (next: string[]) => {
    // Trim; if every slot is empty, store [] (all defaults) — keeps the row tidy.
    const cleaned = next.map((s) => s.trim());
    onSave(cleaned.some((s) => s.length > 0) ? cleaned : []);
  };

  return (
    <div className="mt-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted mb-1">{t("methodology.screenshotNames")}</p>
      <div className="flex flex-col gap-2">
        {defaults.map((def, i) => (
          <input
            key={i}
            type="text"
            value={labels[i]}
            placeholder={def}
            onChange={(e) => setLabels((prev) => prev.map((s, j) => (j === i ? e.target.value : s)))}
            onBlur={() => commit(labels)}
            className="input py-1.5 text-sm"
          />
        ))}
      </div>
      <p className="font-mono text-[10px] mt-1 text-muted">{t("methodology.screenshotNamesHint")}</p>
    </div>
  );
}

/** A built-in trade-form field, greyed and non-interactive — context only. */
function NativeRow({ label, badge }: { label: string; badge: string }) {
  return (
    <div className="flex items-center gap-2 py-2 opacity-55">
      <span className="min-w-0 flex-1 truncate font-body text-sm text-muted">{label}</span>
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-muted border border-border-soft rounded px-1.5 py-0.5">
        {badge}
      </span>
    </div>
  );
}

/** One form section (Entry / Result / Technical / Extra velden) in the editor. */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <p className="font-display text-base italic text-ink mb-2 pb-1 border-b border-border-soft">{title}</p>
      {children}
    </div>
  );
}

/**
 * Editor for the active methodology's fields (Scope C, cyclus 2). System templates
 * are read-only until the user forks an editable copy. Fields are shown grouped by
 * section, each choice-list field lists its options as chips, and options are edited
 * one by one (no comma-string) — see the redesign, 2026-09.
 */
export function MethodologyEditor() {
  const { t } = useTranslation();
  const {
    methodology,
    fields,
    isOwn,
    loading,
    error,
    fork,
    addField,
    updateField,
    deleteField,
    moveFieldFlat,
    reorderField,
    setScreenshotLabels,
  } = useMethodologyEditor();
  // Collapsed by default, same as the review-sections editor below it — the field
  // list is long and, once set up, rarely retouched.
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Live preview of the trade form, shown under the field list so a user never has
  // to leave Settings to see how a change lands (owner feedback 2026-09-22).
  const [showPreview, setShowPreview] = useState(true);
  // Drag-and-drop: the field currently being dragged (owner 2026-09-22). Dropping it
  // onto another row re-orders + re-homes it to that row's section.
  const [draggingId, setDraggingId] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, failKey: string) {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setActionError(toErrorMessage(err, t(failKey)));
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

  const summary = t("methodology.fieldCount", { count: fields.length });

  // Classify config fields into the trade form's sections so the editor mirrors it
  // top-to-bottom (owner 2026-09-22): `cc` sits in Entry, setup/markt/mindset in
  // Technical (kept in their group sub-buckets), the rest in "Extra velden". Result
  // has no config fields — only greyed built-ins.
  const isWpm = fields.some((f) => f.field_key === "fase");
  const natives = nativeFields(t, isWpm, fields.some((f) => f.field_key === "cc"));
  const badge = t("methodology.fixedField");
  const entryConfigs = fields.filter((f) => f.field_key === "cc");
  const technicalFields = fields.filter((f) => f.field_key !== "cc" && WOVEN_KEYS.includes(f.group_key ?? ""));
  const extraFields = fields.filter((f) => f.field_key !== "cc" && !WOVEN_KEYS.includes(f.group_key ?? ""));

  // One editable config-field row, wired for arrows AND drag-and-drop. First/last are
  // against the flat list so a field is never stuck at a section edge.
  const renderRow = (f: MethodologyField) => {
    const flatIdx = fields.findIndex((ff) => ff.id === f.id);
    return (
      <FieldRow
        key={f.id}
        field={f}
        allFields={fields}
        editable={isOwn && !busy}
        isFirst={flatIdx === 0}
        isLast={flatIdx === fields.length - 1}
        isDragging={draggingId === f.id}
        onDragStart={() => setDraggingId(f.id)}
        onDragEnd={() => setDraggingId(null)}
        onDropField={() => {
          const dragged = draggingId;
          setDraggingId(null);
          if (dragged && dragged !== f.id) void run(() => reorderField(dragged, f.id), "methodology.saveFailed");
        }}
        onMove={(dir) => void run(() => moveFieldFlat(f.id, dir), "methodology.saveFailed")}
        onDelete={() => void run(() => deleteField(f.id), "methodology.saveFailed")}
        onSave={(patch) => run(() => updateField(f.id, patch), "methodology.saveFailed")}
        onAddOption={(value) =>
          run(() => updateField(f.id, { options: [...(f.options ?? []), value] }), "methodology.saveFailed")
        }
      />
    );
  };

  return (
    // When open, the card breaks out to the right (there's empty space beside the
    // narrow Settings column) so the live preview can sit next to the editor for
    // side-by-side comparison — owner 2026-09-22. Capped to the viewport so it never
    // adds a horizontal scrollbar; below xl it stays narrow and the preview stacks.
    <Card className={open ? "xl:w-[72rem] xl:max-w-[calc(100vw-19rem)]" : undefined}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-body text-sm text-ink">
            {methodology.naam}
            {methodology.asset_class && (
              <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-muted">
                {methodology.asset_class}
              </span>
            )}
          </p>
          <p className="font-mono text-xs mt-1 text-muted">
            {open ? (isOwn ? t("methodology.ownDescription") : t("methodology.templateDescription")) : summary}
          </p>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-border-soft xl:grid xl:grid-cols-[minmax(0,1fr)_34rem] xl:gap-8 xl:items-start">
          <div className="flex flex-col min-w-0">
          {!isOwn && (
            <button
              type="button"
              onClick={() => void run(fork, "methodology.forkFailed")}
              disabled={busy}
              className="mb-4 self-start px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40"
            >
              {t("methodology.makeEditable")}
            </button>
          )}

          {actionError && <p className="font-mono text-[11px] mb-3 text-loss">{actionError}</p>}
          {error && !actionError && <p className="font-mono text-[11px] mb-3 text-loss">{error}</p>}

          {fields.length === 0 && <p className="font-mono text-xs text-muted py-4">{t("methodology.empty")}</p>}

          {/* Entry — built-ins + WPM's cc (4H candle close) config field. */}
          <FormSection title={t("tradeForm.sectionEntry")}>
            <div className="flex flex-col divide-y divide-border-soft border-t border-border-soft">
              {natives.entry.map((label) => (
                <NativeRow key={label} label={label} badge={badge} />
              ))}
              {entryConfigs.map(renderRow)}
            </div>
          </FormSection>

          {/* Result — all built-in, nothing configurable here. */}
          <FormSection title={t("tradeForm.sectionResult")}>
            <div className="flex flex-col divide-y divide-border-soft border-t border-border-soft">
              {natives.result.map((label) => (
                <NativeRow key={label} label={label} badge={badge} />
              ))}
            </div>
          </FormSection>

          {/* Technical analysis — your config fields in the journal's own order (flat,
              matching the form) + the built-in screenshots/notes greyed below. */}
          <FormSection title={t("tradeForm.sectionTechnical")}>
            {technicalFields.length > 0 && (
              <div className="flex flex-col divide-y divide-border-soft border-t border-border-soft">
                {technicalFields.map(renderRow)}
              </div>
            )}
            {/* Screenshot slots — names are editable per journal (0060). */}
            {isOwn ? (
              <ScreenshotLabelsEditor
                defaults={natives.screenshots}
                value={methodology.screenshot_labels}
                onSave={(next) => void run(() => setScreenshotLabels(next), "methodology.saveFailed")}
              />
            ) : (
              <div className="mt-3 flex flex-col divide-y divide-border-soft border-t border-border-soft">
                {natives.screenshots.map((label) => (
                  <NativeRow key={label} label={label} badge={badge} />
                ))}
              </div>
            )}
            {/* Notes stays a fixed built-in field. */}
            <div className="mt-3 flex flex-col divide-y divide-border-soft border-t border-border-soft">
              <NativeRow label={natives.notes} badge={badge} />
            </div>
          </FormSection>

          {/* Extra velden — ungrouped own fields + the add-field control. */}
          <FormSection title={t("tradeForm.customSectionHeading")}>
            {extraFields.length > 0 && (
              <div className="flex flex-col divide-y divide-border-soft border-t border-border-soft">
                {extraFields.map(renderRow)}
              </div>
            )}
            {isOwn && (
              <AddFieldForm
                busy={busy}
                allFields={fields}
                onAdd={(input) => run(() => addField(input), "methodology.saveFailed")}
              />
            )}
          </FormSection>
          </div>

          {/* Preview: below the editor on narrow screens, a sticky right column on
              xl+ so it stays in view while scrolling a long field list. */}
          <div className="mt-6 pt-4 border-t border-border-soft xl:mt-0 xl:pt-0 xl:border-t-0 xl:sticky xl:top-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{t("methodology.previewHeading")}</p>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                aria-expanded={showPreview}
                className="font-mono text-[11px] text-muted hover:text-ink"
              >
                {showPreview ? t("methodology.previewHide") : t("methodology.previewShow")}
              </button>
            </div>
            <p className="font-mono text-[11px] mt-1 mb-3 text-muted">{t("methodology.previewHint")}</p>
            {showPreview && <MethodologyPreview />}
          </div>
        </div>
      )}
    </Card>
  );
}

function typeLabel(t: (k: string) => string, type: MethodologyField["field_type"]): string {
  return t(`methodology.type_${type}`);
}

function conditionSummary(t: TFunction, f: MethodologyField, allFields: MethodologyField[]): string {
  if (!f.show_when_field_id || !f.show_when_values || f.show_when_values.length === 0) return t("methodology.always");
  const parent = allFields.find((p) => p.id === f.show_when_field_id);
  const parentLabel = parent ? fieldLabel(t, parent) : "?";
  return `${parentLabel} = ${f.show_when_values.join(", ")}`;
}

function FieldRow({
  field,
  allFields,
  editable,
  isFirst,
  isLast,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropField,
  onMove,
  onDelete,
  onSave,
  onAddOption,
}: {
  field: MethodologyField;
  allFields: MethodologyField[];
  editable: boolean;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropField: () => void;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
  onSave: (patch: Partial<FieldInput>) => Promise<void>;
  onAddOption: (value: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickValue, setQuickValue] = useState("");
  const [dragOver, setDragOver] = useState(false);

  if (editing) {
    return (
      <FieldForm
        initial={field}
        allFields={allFields}
        submitLabel={t("methodology.save")}
        onCancel={() => setEditing(false)}
        onSubmit={async (input) => {
          // field_key is immutable on an existing field (it keys trades.custom) — omit it from the patch.
          // The label edits the *translated* text (0047), so only persist it when it
          // actually changed, or a no-op save would re-freeze the translation (the DB
          // trigger clears label_key on any rewrite of the free text). The section is
          // chosen from a dropdown that carries the raw group_key/group_label pair, so
          // both go in verbatim — the trigger only clears group_key when the label
          // changes *without* a matching key, which the pair never does.
          const displayLabel = fieldLabel(t, field);
          await onSave({
            ...(input.label !== displayLabel ? { label: input.label } : {}),
            field_type: input.field_type,
            options: input.options,
            required: input.required,
            group_key: input.group_key,
            group_label: input.group_label,
            show_when_field_id: input.show_when_field_id,
            show_when_values: input.show_when_values,
          });
          setEditing(false);
        }}
      />
    );
  }

  const isEnum = field.field_type === "enum";

  async function submitQuickAdd() {
    const v = quickValue.trim();
    if (!v || (field.options ?? []).includes(v)) {
      setQuickValue("");
      setQuickAdd(false);
      return;
    }
    await onAddOption(v);
    setQuickValue("");
    setQuickAdd(false);
  }

  return (
    <div
      draggable={editable && !quickAdd}
      onDragStart={editable ? onDragStart : undefined}
      onDragEnd={editable ? onDragEnd : undefined}
      onDragOver={
        editable
          ? (e) => {
              e.preventDefault();
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={editable ? () => setDragOver(false) : undefined}
      onDrop={
        editable
          ? (e) => {
              e.preventDefault();
              setDragOver(false);
              onDropField();
            }
          : undefined
      }
      className={`flex items-start gap-2 py-2.5 ${isDragging ? "opacity-40" : ""} ${
        dragOver ? "border-t-2 border-gold -mt-px" : ""
      }`}
    >
      {editable && (
        <span
          className="mt-0.5 shrink-0 cursor-grab text-muted/50 hover:text-muted"
          title={t("methodology.dragHint")}
          aria-hidden
        >
          <GripVertical size={14} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-body text-sm text-ink truncate">
          {fieldLabel(t, field)}
          {field.required && <span className="ml-1.5 text-loss">*</span>}
          <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-muted">
            {typeLabel(t, field.field_type)}
          </span>
          {field.is_computed && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-muted">
              {t("methodology.computed")}
            </span>
          )}
        </p>

        {isEnum && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {(field.options ?? []).map((opt) => (
              <span
                key={opt}
                className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-gold/10 text-ink"
              >
                {opt}
              </span>
            ))}
            {editable &&
              (quickAdd ? (
                <input
                  type="text"
                  autoFocus
                  value={quickValue}
                  onChange={(e) => setQuickValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submitQuickAdd();
                    } else if (e.key === "Escape") {
                      setQuickValue("");
                      setQuickAdd(false);
                    }
                  }}
                  onBlur={() => void submitQuickAdd()}
                  placeholder={t("methodology.optionPlaceholder")}
                  className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-surface-2 border border-gold text-ink outline-none w-32"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setQuickAdd(true)}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-mono text-[11px] border border-dashed border-border text-muted hover:border-gold hover:text-ink"
                >
                  <Plus size={11} /> {t("methodology.optionShort")}
                </button>
              ))}
          </div>
        )}

        <p className="font-mono text-[11px] mt-1 text-muted truncate">
          {field.field_key} · {t("methodology.condition")}: {conditionSummary(t, field, allFields)}
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

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
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
      className={`p-1.5 rounded-md hover:bg-ink/5 disabled:opacity-30 disabled:cursor-not-allowed ${
        danger ? "hover:text-loss" : "hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function AddFieldForm({
  busy,
  allFields,
  onAdd,
}: {
  busy: boolean;
  allFields: MethodologyField[];
  onAdd: (input: FieldInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="mt-4 px-4 py-2 rounded-lg font-body text-sm font-medium border border-border text-ink hover:border-gold disabled:opacity-40"
      >
        + {t("methodology.addField")}
      </button>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-border-soft">
      <FieldForm
        allFields={allFields}
        submitLabel={t("methodology.add")}
        onCancel={() => setOpen(false)}
        onSubmit={async (input) => {
          await onAdd(input);
          setOpen(false);
        }}
      />
    </div>
  );
}

/** Per-option editor for enum fields — one row per choice (reorder + remove), plus
 *  an add box where Enter appends. Replaces the old comma-separated text field so a
 *  single option can be added/removed/reordered and commas in a label are safe. */
function OptionsEditor({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v || options.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...options, v]);
    setDraft("");
  }
  function remove(i: number) {
    onChange(options.filter((_, j) => j !== i));
  }
  function move(i: number, dir: "up" | "down") {
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[11px] text-muted">{t("methodology.fieldOptions")}</label>
      {options.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {options.map((opt, i) => (
            <div
              key={`${opt}-${i}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border"
            >
              <span className="flex-1 min-w-0 truncate font-body text-sm text-ink">{opt}</span>
              <div className="flex items-center gap-0.5 shrink-0 text-muted">
                <IconBtn label={t("methodology.moveUp")} disabled={i === 0} onClick={() => move(i, "up")}>
                  <ChevronUp size={14} />
                </IconBtn>
                <IconBtn label={t("methodology.moveDown")} disabled={i === options.length - 1} onClick={() => move(i, "down")}>
                  <ChevronDown size={14} />
                </IconBtn>
                <IconBtn label={t("methodology.optionRemove")} danger onClick={() => remove(i)}>
                  <X size={14} />
                </IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t("methodology.optionPlaceholder")}
          className="input flex-1"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg font-body text-sm font-medium border border-gold text-gold disabled:opacity-40"
        >
          <Plus size={14} /> {t("methodology.add")}
        </button>
      </div>
      {options.length === 0 && <p className="font-mono text-[10px] text-muted">{t("methodology.optionsEmpty")}</p>}
    </div>
  );
}

/** Shared add/edit form for a field. field_key is derived from the label for new fields, read-only for existing. */
function FieldForm({
  initial,
  allFields,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: MethodologyField;
  allFields: MethodologyField[];
  submitLabel: string;
  onSubmit: (input: FieldInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isNew = !initial;
  // Edit the translated display text (0047), not the frozen stored text — the
  // caller (FieldRow) compares against the same display values and only persists
  // a real change, so the translation never gets re-frozen by a no-op save.
  const [label, setLabel] = useState(initial ? fieldLabel(t, initial) : "");
  const [fieldType, setFieldType] = useState<MethodologyField["field_type"]>(initial?.field_type ?? "boolean");
  const [options, setOptions] = useState<string[]>(initial?.options ?? []);
  const [required, setRequired] = useState(initial?.required ?? false);
  // Section is picked from the methodology's existing sections (raw group_key +
  // group_label, so re-attaching never drifts) — or a brand-new one, or none.
  const sections = collectSections(allFields, t);
  const [groupKey, setGroupKey] = useState<string | null>(initial?.group_key ?? null);
  const [groupLabel, setGroupLabel] = useState<string | null>(initial?.group_label ?? null);
  const [newSection, setNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [showWhenFieldId, setShowWhenFieldId] = useState<string | null>(initial?.show_when_field_id ?? null);
  const [showWhenValues, setShowWhenValues] = useState<string[]>(initial?.show_when_values ?? []);
  const [saving, setSaving] = useState(false);

  // A condition can only key off another enum field's values — exclude self (a
  // field can't depend on itself). Matches the model in the design doc §2.4.
  const parentCandidates = allFields.filter(
    (f) => f.field_type === "enum" && (f.options?.length ?? 0) > 0 && f.id !== initial?.id
  );
  const parent = parentCandidates.find((f) => f.id === showWhenFieldId) ?? null;

  function toggleValue(v: string) {
    setShowWhenValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  // If a parent is chosen, at least one value must be ticked, else the condition
  // would never match and the field would be permanently hidden.
  const conditionValid = !showWhenFieldId || showWhenValues.length > 0;
  // Two labels can slugify to the same key — catch it here with a readable message
  // instead of letting the DB unique constraint surface a raw error.
  const duplicateKey = isNew && label.trim().length > 0 && allFields.some((f) => f.field_key === slugifyFieldKey(label));
  const canSave =
    label.trim().length > 0 &&
    !duplicateKey &&
    (fieldType !== "enum" || options.length > 0) &&
    conditionValid &&
    (!newSection || newSectionName.trim().length > 0);

  // The section that gets written: a typed new one (label + slugified key), or the
  // pair currently held in state (an existing section, or null/null for "no section").
  function resolveGroup(): { group_key: string | null; group_label: string | null } {
    if (newSection) {
      const name = newSectionName.trim();
      return name ? { group_key: slugifyFieldKey(name), group_label: name } : { group_key: null, group_label: null };
    }
    return { group_key: groupKey, group_label: groupLabel };
  }

  // Which <option> is selected right now — "__new__"/"__none__" or a section id.
  const selectedSectionId = newSection
    ? "__new__"
    : groupKey == null && groupLabel == null
      ? "__none__"
      : groupKey ?? `label:${groupLabel}`;

  function handleSectionChange(value: string) {
    if (value === "__new__") {
      setNewSection(true);
      return;
    }
    setNewSection(false);
    if (value === "__none__") {
      setGroupKey(null);
      setGroupLabel(null);
      return;
    }
    const section = sections.find((s) => s.id === value);
    setGroupKey(section?.group_key ?? null);
    setGroupLabel(section?.group_label ?? null);
  }

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      const group = resolveGroup();
      await onSubmit({
        field_key: initial?.field_key ?? slugifyFieldKey(label),
        label: label.trim(),
        label_key: null, // hand-made/edited here — free text is the source; edits keep keys via the FieldRow patch, the DB trigger clears them on a real rename
        field_type: fieldType,
        options: fieldType === "enum" ? options : null,
        required,
        group_label: group.group_label,
        group_key: group.group_key,
        show_when_field_id: showWhenFieldId,
        show_when_values: showWhenFieldId ? showWhenValues : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex flex-col gap-1">
        <label className="font-mono text-[11px] text-muted">{t("methodology.fieldLabel")}</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("methodology.labelPlaceholder")}
          className="input"
          autoFocus
        />
        {isNew && label.trim() && (
          <p className="font-mono text-[10px] text-muted">
            {t("methodology.keyPreview")}: {slugifyFieldKey(label)}
          </p>
        )}
        {duplicateKey && <p className="font-mono text-[10px] text-loss">{t("methodology.duplicateKey")}</p>}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[11px] text-muted">{t("methodology.fieldType")}</label>
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as MethodologyField["field_type"])}
            className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
          >
            {FIELD_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {typeLabel(t, ft)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[11px] text-muted">{t("methodology.group")}</label>
          <select
            value={selectedSectionId}
            onChange={(e) => handleSectionChange(e.target.value)}
            className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
          >
            <option value="__none__">{t("methodology.groupNone")}</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display}
              </option>
            ))}
            <option value="__new__">{t("methodology.groupNew")}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[11px] text-muted">{t("methodology.required")}</label>
          <BooleanToggle value={required} onChange={setRequired} labels={[t("settings.on"), t("settings.off")]} />
        </div>
      </div>

      {newSection && (
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[11px] text-muted">{t("methodology.groupNewName")}</label>
          <input
            type="text"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            placeholder={t("methodology.labelPlaceholder")}
            className="input"
            autoFocus
          />
        </div>
      )}

      {fieldType === "enum" && <OptionsEditor options={options} onChange={setOptions} />}

      <div className="flex flex-col gap-1.5 pt-1 border-t border-border-soft">
        <label className="font-mono text-[11px] text-muted">{t("methodology.visibility")}</label>
        {parentCandidates.length === 0 ? (
          <p className="font-mono text-[10px] text-muted">{t("methodology.conditionNoEnum")}</p>
        ) : (
          <>
            <select
              value={showWhenFieldId ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                setShowWhenFieldId(id);
                setShowWhenValues([]); // reset ticks — a new parent has different options
              }}
              className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold self-start"
            >
              <option value="">{t("methodology.conditionAlways")}</option>
              {parentCandidates.map((f) => (
                <option key={f.id} value={f.id}>
                  {t("methodology.conditionWhen", { field: fieldLabel(t, f) })}
                </option>
              ))}
            </select>
            {parent && (
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="font-mono text-[10px] text-muted">
                  {t("methodology.conditionValues", { field: fieldLabel(t, parent) })}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(parent.options ?? []).map((opt) => {
                    const on = showWhenValues.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleValue(opt)}
                        className={`px-2.5 py-1 rounded-full font-mono text-[11px] border transition-colors ${
                          on ? "bg-gold text-on-gold border-gold" : "border-border text-muted hover:border-gold"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {!conditionValid && (
                  <span className="font-mono text-[10px] text-loss">{t("methodology.conditionPickValue")}</span>
                )}
              </div>
            )}
          </>
        )}
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
