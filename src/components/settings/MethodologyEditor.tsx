import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, Lock, Pencil, Trash2, X, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useMethodologyEditor, type FieldInput } from "@/hooks/useMethodologyEditor";
import { isLockedLegacyField, parseFieldOptions, slugifyFieldKey } from "@/lib/methodologyFields";
import type { MethodologyField } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";

const FIELD_TYPES: MethodologyField["field_type"][] = ["boolean", "enum", "text", "number", "date"];

/**
 * Editor for the active methodology's fields (Scope C, cyclus 2). System templates
 * are read-only until the user forks an editable copy. Conditional visibility
 * (show_when) is shown read-only here; editing conditions comes later.
 */
export function MethodologyEditor() {
  const { t } = useTranslation();
  const { methodology, fields, isOwn, loading, error, fork, addField, updateField, deleteField, moveField } =
    useMethodologyEditor();
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

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
            {isOwn ? t("methodology.ownDescription") : t("methodology.templateDescription")}
          </p>
        </div>
        {!isOwn && (
          <button
            type="button"
            onClick={() => void run(fork, "methodology.forkFailed")}
            disabled={busy}
            className="shrink-0 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40"
          >
            {t("methodology.makeEditable")}
          </button>
        )}
      </div>

      {actionError && <p className="font-mono text-[11px] mt-3 text-loss">{actionError}</p>}
      {error && !actionError && <p className="font-mono text-[11px] mt-3 text-loss">{error}</p>}

      <div className="flex flex-col divide-y divide-border-soft mt-4 border-t border-border-soft">
        {fields.length === 0 && <p className="font-mono text-xs text-muted py-4">{t("methodology.empty")}</p>}
        {fields.map((f, i) => (
          <FieldRow
            key={f.id}
            field={f}
            allFields={fields}
            editable={isOwn && !busy}
            // Seeded WPM fields stay column-backed (`fase` even enum-backed in the
            // DB — editing its options would break every trade save) → locked
            // until the cyclus-10 migration. useMethodologyEditor backstops this.
            locked={isLockedLegacyField(f, fields)}
            isFirst={i === 0}
            isLast={i === fields.length - 1}
            onMove={(dir) => void run(() => moveField(f.id, dir), "methodology.saveFailed")}
            onDelete={() => void run(() => deleteField(f.id), "methodology.saveFailed")}
            onSave={(patch) => run(() => updateField(f.id, patch), "methodology.saveFailed")}
          />
        ))}
      </div>

      {isOwn && (
        <AddFieldForm
          busy={busy}
          allFields={fields}
          onAdd={(input) => run(() => addField(input), "methodology.saveFailed")}
        />
      )}
    </Card>
  );
}

function typeLabel(t: (k: string) => string, type: MethodologyField["field_type"]): string {
  return t(`methodology.type_${type}`);
}

function conditionSummary(t: (k: string) => string, f: MethodologyField, allFields: MethodologyField[]): string {
  if (!f.show_when_field_id || !f.show_when_values || f.show_when_values.length === 0) return t("methodology.always");
  const parent = allFields.find((p) => p.id === f.show_when_field_id);
  const parentLabel = parent?.label ?? "?";
  return `${parentLabel} = ${f.show_when_values.join(", ")}`;
}

function FieldRow({
  field,
  allFields,
  editable,
  locked,
  isFirst,
  isLast,
  onMove,
  onDelete,
  onSave,
}: {
  field: MethodologyField;
  allFields: MethodologyField[];
  editable: boolean;
  locked: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
  onSave: (patch: Partial<FieldInput>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <FieldForm
        initial={field}
        allFields={allFields}
        submitLabel={t("methodology.save")}
        onCancel={() => setEditing(false)}
        onSubmit={async (input) => {
          // field_key is immutable on an existing field (it keys trades.custom) — omit it from the patch.
          await onSave({
            label: input.label,
            field_type: input.field_type,
            options: input.options,
            required: input.required,
            group_label: input.group_label,
            show_when_field_id: input.show_when_field_id,
            show_when_values: input.show_when_values,
          });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-body text-sm text-ink truncate">
          {field.label}
          {field.required && <span className="ml-1.5 text-loss">*</span>}
          {field.is_computed && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-muted">
              {t("methodology.computed")}
            </span>
          )}
        </p>
        <p className="font-mono text-[11px] mt-0.5 text-muted truncate">
          {field.field_key} · {typeLabel(t, field.field_type)}
          {field.field_type === "enum" && field.options?.length ? ` (${field.options.join(", ")})` : ""}
          {" · "}
          {t("methodology.condition")}: {conditionSummary(t, field, allFields)}
        </p>
      </div>
      {editable && locked && (
        <span className="shrink-0 p-1.5 text-muted" title={t("methodology.legacyLocked")} aria-label={t("methodology.legacyLocked")}>
          <Lock size={14} />
        </span>
      )}
      {editable && !locked && (
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
  const [label, setLabel] = useState(initial?.label ?? "");
  const [fieldType, setFieldType] = useState<MethodologyField["field_type"]>(initial?.field_type ?? "boolean");
  const [optionsRaw, setOptionsRaw] = useState((initial?.options ?? []).join(", "));
  const [required, setRequired] = useState(initial?.required ?? false);
  const [group, setGroup] = useState(initial?.group_label ?? "");
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
    (fieldType !== "enum" || parseFieldOptions(optionsRaw).length > 0) &&
    conditionValid;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        field_key: initial?.field_key ?? slugifyFieldKey(label),
        label: label.trim(),
        field_type: fieldType,
        options: fieldType === "enum" ? parseFieldOptions(optionsRaw) : null,
        required,
        group_label: group.trim() || null,
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

      {fieldType === "enum" && (
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[11px] text-muted">{t("methodology.fieldOptions")}</label>
          <input
            type="text"
            value={optionsRaw}
            onChange={(e) => setOptionsRaw(e.target.value)}
            placeholder={t("methodology.optionsPlaceholder")}
            className="input"
          />
          <p className="font-mono text-[10px] text-muted">{t("methodology.fieldOptionsHint")}</p>
        </div>
      )}

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
                  {t("methodology.conditionWhen", { field: f.label })}
                </option>
              ))}
            </select>
            {parent && (
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="font-mono text-[10px] text-muted">
                  {t("methodology.conditionValues", { field: parent.label })}
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
