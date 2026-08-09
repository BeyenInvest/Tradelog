import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, Pencil, Trash2, X, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useMethodologyEditor, type FieldInput } from "@/hooks/useMethodologyEditor";
import type { MethodologyField } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";

const FIELD_TYPES: MethodologyField["field_type"][] = ["boolean", "enum", "text", "number", "date"];

/** label -> stable field_key (lowercase, underscores). */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "veld"
  );
}

/** Parse a comma/newline separated string into a trimmed, de-duplicated options list. */
function parseOptions(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const v = part.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

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
            editable={isOwn && !busy}
            isFirst={i === 0}
            isLast={i === fields.length - 1}
            onMove={(dir) => void run(() => moveField(f.id, dir), "methodology.saveFailed")}
            onDelete={() => void run(() => deleteField(f.id), "methodology.saveFailed")}
            onSave={(patch) => run(() => updateField(f.id, patch), "methodology.saveFailed")}
          />
        ))}
      </div>

      {isOwn && <AddFieldForm busy={busy} onAdd={(input) => run(() => addField(input), "methodology.saveFailed")} />}
    </Card>
  );
}

function typeLabel(t: (k: string) => string, type: MethodologyField["field_type"]): string {
  return t(`methodology.type_${type}`);
}

function conditionSummary(t: (k: string) => string, f: MethodologyField): string {
  if (!f.show_when_field_id || !f.show_when_values || f.show_when_values.length === 0) return t("methodology.always");
  return f.show_when_values.join(", ");
}

function FieldRow({
  field,
  editable,
  isFirst,
  isLast,
  onMove,
  onDelete,
  onSave,
}: {
  field: MethodologyField;
  editable: boolean;
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
          {t("methodology.condition")}: {conditionSummary(t, field)}
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

function AddFieldForm({ busy, onAdd }: { busy: boolean; onAdd: (input: FieldInput) => Promise<void> }) {
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
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: MethodologyField;
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
  const [saving, setSaving] = useState(false);

  const canSave = label.trim().length > 0 && (fieldType !== "enum" || parseOptions(optionsRaw).length > 0);

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        field_key: initial?.field_key ?? slugify(label),
        label: label.trim(),
        field_type: fieldType,
        options: fieldType === "enum" ? parseOptions(optionsRaw) : null,
        required,
        group_label: group.trim() || null,
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
            {t("methodology.keyPreview")}: {slugify(label)}
          </p>
        )}
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
