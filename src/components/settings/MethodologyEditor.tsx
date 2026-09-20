import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ChevronUp, ChevronDown, Pencil, Trash2, X, Check, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useMethodologyEditor, type FieldInput } from "@/hooks/useMethodologyEditor";
import { slugifyFieldKey } from "@/lib/methodologyFields";
import { fieldGroupLabel, fieldLabel } from "@/lib/fieldBlocks";
import type { MethodologyField } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";

const FIELD_TYPES: MethodologyField["field_type"][] = ["boolean", "enum", "text", "number", "date"];

/** Stable grouping identity — same section iff same group_key (or, for hand-made
 *  fields without a key, same free-text group_label). Empty = ungrouped. */
function groupIdentity(f: MethodologyField): string {
  return f.group_key ?? f.group_label ?? "";
}

/**
 * Editor for the active methodology's fields (Scope C, cyclus 2). System templates
 * are read-only until the user forks an editable copy. Fields are shown grouped by
 * section, each choice-list field lists its options as chips, and options are edited
 * one by one (no comma-string) — see the redesign, 2026-09.
 */
export function MethodologyEditor() {
  const { t } = useTranslation();
  const { methodology, fields, isOwn, loading, error, fork, addField, updateField, deleteField, swapFieldOrder } =
    useMethodologyEditor();
  // Collapsed by default, same as the review-sections editor below it — the field
  // list is long and, once set up, rarely retouched.
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  // Bucket fields (already in sort_order) by section, first-seen order, ungrouped last.
  const buckets = new Map<string, MethodologyField[]>();
  for (const f of fields) {
    const id = groupIdentity(f);
    const arr = buckets.get(id);
    if (arr) arr.push(f);
    else buckets.set(id, [f]);
  }
  const keys = [...buckets.keys()];
  const orderedKeys = [...keys.filter((k) => k !== ""), ...keys.filter((k) => k === "")];

  return (
    <Card>
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
        <div className="mt-4 pt-4 border-t border-border-soft">
          {!isOwn && (
            <button
              type="button"
              onClick={() => void run(fork, "methodology.forkFailed")}
              disabled={busy}
              className="mb-4 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40"
            >
              {t("methodology.makeEditable")}
            </button>
          )}

          {actionError && <p className="font-mono text-[11px] mb-3 text-loss">{actionError}</p>}
          {error && !actionError && <p className="font-mono text-[11px] mb-3 text-loss">{error}</p>}

          {fields.length === 0 && <p className="font-mono text-xs text-muted py-4">{t("methodology.empty")}</p>}

          {orderedKeys.map((gkey) => {
            const groupFields = buckets.get(gkey) ?? [];
            const heading = gkey === "" ? t("methodology.groupOther") : fieldGroupLabel(t, groupFields[0]);
            return (
              <div key={gkey || "__ungrouped"} className="mt-4 first:mt-0">
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted mb-1">{heading}</p>
                <div className="flex flex-col divide-y divide-border-soft border-t border-border-soft">
                  {groupFields.map((f, i) => (
                    <FieldRow
                      key={f.id}
                      field={f}
                      allFields={fields}
                      editable={isOwn && !busy}
                      isFirst={i === 0}
                      isLast={i === groupFields.length - 1}
                      onMove={(dir) =>
                        void run(
                          () => swapFieldOrder(f.id, groupFields[dir === "up" ? i - 1 : i + 1].id),
                          "methodology.saveFailed"
                        )
                      }
                      onDelete={() => void run(() => deleteField(f.id), "methodology.saveFailed")}
                      onSave={(patch) => run(() => updateField(f.id, patch), "methodology.saveFailed")}
                      onAddOption={(value) =>
                        run(() => updateField(f.id, { options: [...(f.options ?? []), value] }), "methodology.saveFailed")
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {isOwn && (
            <AddFieldForm
              busy={busy}
              allFields={fields}
              onAdd={(input) => run(() => addField(input), "methodology.saveFailed")}
            />
          )}
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
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
  onSave: (patch: Partial<FieldInput>) => Promise<void>;
  onAddOption: (value: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickValue, setQuickValue] = useState("");

  if (editing) {
    return (
      <FieldForm
        initial={field}
        allFields={allFields}
        submitLabel={t("methodology.save")}
        onCancel={() => setEditing(false)}
        onSubmit={async (input) => {
          // field_key is immutable on an existing field (it keys trades.custom) — omit it from the patch.
          // label/group_label go in only when they actually changed vs what the user
          // sees: the form edits the *translated* text (0047), and writing it back
          // unchanged would re-freeze the translation (the DB trigger clears
          // label_key/group_key on any rewrite of the free text).
          const displayLabel = fieldLabel(t, field);
          const displayGroup = fieldGroupLabel(t, field);
          await onSave({
            ...(input.label !== displayLabel ? { label: input.label } : {}),
            field_type: input.field_type,
            options: input.options,
            required: input.required,
            ...((input.group_label ?? null) !== displayGroup ? { group_label: input.group_label } : {}),
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
    <div className="flex items-start gap-3 py-2.5">
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
  const [group, setGroup] = useState(initial ? fieldGroupLabel(t, initial) ?? "" : "");
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
    label.trim().length > 0 && !duplicateKey && (fieldType !== "enum" || options.length > 0) && conditionValid;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        field_key: initial?.field_key ?? slugifyFieldKey(label),
        label: label.trim(),
        label_key: null, // hand-made/edited here — free text is the source; edits keep keys via the FieldRow patch, the DB trigger clears them on a real rename
        field_type: fieldType,
        options: fieldType === "enum" ? options : null,
        required,
        group_label: group.trim() || null,
        group_key: null,
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
          <input
            type="text"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder={t("methodology.groupPlaceholder")}
            className="input"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[11px] text-muted">{t("methodology.required")}</label>
          <BooleanToggle value={required} onChange={setRequired} labels={[t("settings.on"), t("settings.off")]} />
        </div>
      </div>

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
