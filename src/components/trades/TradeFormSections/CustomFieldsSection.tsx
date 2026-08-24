import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Check, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import type { TradeFormValues } from "@/lib/validation";
import type { MethodologyField } from "@/lib/types";
import { useMethodology, type InlineFieldInput } from "@/hooks/useMethodology";
import {
  dynamicMethodologyFields,
  isFieldVisible,
  parseFieldOptions,
  slugifyFieldKey,
} from "@/lib/methodologyFields";
import { fieldGroupLabel, fieldLabel } from "@/lib/fieldBlocks";
import { toErrorMessage } from "@/lib/errorMessage";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { Field } from "./Field";

const FIELD_TYPES: MethodologyField["field_type"][] = ["boolean", "enum", "text", "number", "date"];

/** Consecutive fields sharing a group header render under one subheading (fields come sort-ordered; header translated at render time, 0047). */
function groupFields(fields: MethodologyField[], t: TFunction): { label: string | null; fields: MethodologyField[] }[] {
  const groups: { label: string | null; fields: MethodologyField[] }[] = [];
  for (const f of fields) {
    const g = fieldGroupLabel(t, f);
    const last = groups.at(-1);
    if (last && last.label === g) last.fields.push(f);
    else groups.push({ label: g, fields: [f] });
  }
  return groups;
}

/**
 * Renders the active methodology's custom fields (Scope C, cyclus 3), driven by
 * methodology_fields rather than hardcoded columns. Values read from / write to
 * the flexible trades.custom bag (keyed by field_key). Conditional visibility
 * (show_when) is honoured, and a field hidden by its condition has its stored
 * value cleared so a stale answer is never persisted.
 *
 * Additive & non-intrusive: legacy Weekly Phase Method fields (fase + kenmerken) stay owned by
 * the hardcoded form, so for a user with only the seeded template this section is
 * empty and the form is unchanged.
 */
export function CustomFieldsSection() {
  const { t } = useTranslation();
  const { fields, isOwnMethodology, addField, updateField, deleteField, renameFieldOption, loading } =
    useMethodology();
  const [managing, setManaging] = useState(false);
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<TradeFormValues>();

  const fase = watch("fase");
  const customVals = (watch("custom") ?? {}) as Record<string, unknown>;

  // Shared with TradeForm's submit-time required-check and customFieldDimensions,
  // so what renders, what's enforced and what's analysed can never drift apart.
  const dynamicFields = dynamicMethodologyFields(fields);
  const isVisible = (f: MethodologyField) => isFieldVisible(f, fields, fase, customVals);

  // Clear the stored value of any field its condition currently hides, so a stale
  // answer from a now-hidden field is never saved to trades.custom.
  useEffect(() => {
    for (const f of dynamicFields) {
      const v = customVals[f.field_key];
      if (!isVisible(f) && v != null && v !== "") {
        setValue(`custom.${f.field_key}`, undefined, { shouldDirty: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, JSON.stringify(customVals)]);

  // Inline field creation (add-while-logging): own journal only — a read-only
  // template can't take fields. Renders the section even with zero fields so a
  // blank journal shows in the form itself that fields exist at all.
  const canAddInline = isOwnMethodology && !loading;

  const visibleFields = dynamicFields.filter(isVisible);
  if (visibleFields.length === 0 && !canAddInline) return null;

  // Deleting a field must also drop its already-entered form value, or the
  // submit would still persist an answer for a field that no longer exists.
  async function handleDelete(f: MethodologyField) {
    await deleteField(f.id);
    setValue(`custom.${f.field_key}`, undefined, { shouldDirty: true });
  }

  // Shrinking an enum's options can orphan the currently selected value — clear
  // it so a no-longer-offered answer is never saved.
  async function handleUpdate(f: MethodologyField, patch: { label?: string; options?: string[] | null }) {
    const row = await updateField(f.id, patch);
    const current = customVals[f.field_key];
    if (row.field_type === "enum" && typeof current === "string" && current !== "" && !(row.options ?? []).includes(current)) {
      setValue(`custom.${f.field_key}`, undefined, { shouldDirty: true });
    }
  }

  // Rename with migration (option list + conditions + logged trades, see
  // useMethodology). The open form's own answer moves along too.
  async function handleRenameOption(f: MethodologyField, oldValue: string, newValue: string): Promise<number> {
    const { migrated } = await renameFieldOption(f.id, oldValue, newValue);
    if (customVals[f.field_key] === oldValue) {
      setValue(`custom.${f.field_key}`, newValue, { shouldDirty: true });
    }
    return migrated;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-lg italic text-ink">{t("tradeForm.customSectionHeading")}</h3>
        {canAddInline && dynamicFields.length > 0 && (
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            aria-pressed={managing}
            aria-label={t("tradeForm.manageFields")}
            title={t("tradeForm.manageFields")}
            className={`p-1.5 rounded-md hover:bg-ink/5 ${managing ? "text-gold" : "text-muted hover:text-ink"}`}
          >
            <Settings2 size={15} />
          </button>
        )}
      </div>
      {visibleFields.length === 0 && (
        <p className="font-mono text-xs text-muted">{t("tradeForm.customSectionEmptyHint")}</p>
      )}
      {managing && canAddInline && (
        <FieldManager
          fields={dynamicFields}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onRenameOption={handleRenameOption}
        />
      )}
      {groupFields(visibleFields, t).map((group, gi) => (
        <div key={group.label ?? `g${gi}`} className="flex flex-col gap-2">
          {group.label && (
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{group.label}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            {group.fields.map((f) => (
              <Field
                key={f.id}
                label={fieldLabel(t, f)}
                required={f.required}
                error={(errors.custom as Record<string, { message?: string }> | undefined)?.[f.field_key]?.message}
              >
                <FieldInput field={f} control={control} register={register} />
              </Field>
            ))}
          </div>
        </div>
      ))}
      {canAddInline && <InlineAddField allFields={fields} onAdd={addField} />}
    </div>
  );
}

/**
 * Inline management of the journal's own fields (the section-gear): rename a
 * field, reshape an enum's options, or delete a field — without leaving the
 * half-filled form. Deliberately shows ALL dynamic fields (also ones currently
 * hidden by a show_when condition), so a field can always be reached here.
 * field_key and type are immutable (the key indexes trades.custom); conditions,
 * required and ordering stay in Settings.
 */
function FieldManager({
  fields,
  onUpdate,
  onDelete,
  onRenameOption,
}: {
  fields: MethodologyField[];
  onUpdate: (f: MethodologyField, patch: { label?: string; options?: string[] | null }) => Promise<void>;
  onDelete: (f: MethodologyField) => Promise<void>;
  onRenameOption: (f: MethodologyField, oldValue: string, newValue: string) => Promise<number>;
}) {
  return (
    <div className="flex flex-col divide-y divide-border-soft rounded-xl border border-border-soft px-3">
      {fields.map((f) => (
        <ManagerRow key={f.id} field={f} onUpdate={onUpdate} onDelete={onDelete} onRenameOption={onRenameOption} />
      ))}
    </div>
  );
}

function ManagerRow({
  field,
  onUpdate,
  onDelete,
  onRenameOption,
}: {
  field: MethodologyField;
  onUpdate: (f: MethodologyField, patch: { label?: string; options?: string[] | null }) => Promise<void>;
  onDelete: (f: MethodologyField) => Promise<void>;
  onRenameOption: (f: MethodologyField, oldValue: string, newValue: string) => Promise<number>;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"idle" | "edit" | "confirmDelete">("idle");
  // Edit the label the user actually sees (translated for a catalogue field, 0047),
  // not the frozen stored text — and only persist it when it really changed, or a
  // no-op save would re-freeze the translation in the current language.
  const displayLabel = fieldLabel(t, field);
  const [label, setLabel] = useState(displayLabel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isEnum = field.field_type === "enum";

  function toIdle() {
    setMode("idle");
    setLabel(displayLabel);
    setError(null);
    setNotice(null);
  }

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(toErrorMessage(err, t("methodology.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  if (mode === "edit") {
    return (
      <div className="flex flex-col gap-2 py-2.5">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[11px] text-muted">{t("methodology.fieldLabel")}</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input"
            autoFocus
          />
        </div>
        {isEnum && (
          <OptionChips
            field={field}
            busy={busy}
            run={run}
            onUpdate={onUpdate}
            onRenameOption={onRenameOption}
            setNotice={setNotice}
          />
        )}
        {notice && <p className="font-mono text-[11px] text-win">{notice}</p>}
        {error && <p className="font-mono text-[11px] text-loss">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={label.trim().length === 0 || busy}
            onClick={() =>
              void run(async () => {
                if (label.trim() !== displayLabel) await onUpdate(field, { label: label.trim() });
                setMode("idle");
                setNotice(null);
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40"
          >
            <Check size={14} /> {t("methodology.save")}
          </button>
          <button
            type="button"
            onClick={toIdle}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-sm text-muted border border-border hover:text-ink"
          >
            <X size={14} /> {t("methodology.cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "confirmDelete") {
    return <ConfirmDeleteRow field={field} busy={busy} error={error} run={run} onDelete={onDelete} onCancel={toIdle} />;
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-body text-sm text-ink truncate">{displayLabel}</p>
        <p className="font-mono text-[11px] mt-0.5 text-muted truncate">
          {field.field_key} · {t(`methodology.type_${field.field_type}`)}
          {isEnum && field.options?.length ? ` (${field.options.join(", ")})` : ""}
        </p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 text-muted">
        <button
          type="button"
          aria-label={t("methodology.edit")}
          title={t("methodology.edit")}
          onClick={() => {
            setLabel(displayLabel); // re-seed: the display label may have re-translated since mount
            setMode("edit");
          }}
          className="p-1.5 rounded-md hover:bg-ink/5 hover:text-ink"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          aria-label={t("methodology.delete")}
          title={t("methodology.delete")}
          onClick={() => setMode("confirmDelete")}
          className="p-1.5 rounded-md hover:bg-ink/5 hover:text-loss"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * Chip-based option editor for an own enum field. Rename is a first-class action
 * here (pencil on the chip), not a delete+add — it migrates the option list,
 * dependent show_when conditions AND every logged trade's stored answer in one
 * go (useMethodology.renameFieldOption), so history never splits into two
 * buckets. Removing the last option is blocked: an enum needs at least one.
 */
function OptionChips({
  field,
  busy,
  run,
  onUpdate,
  onRenameOption,
  setNotice,
}: {
  field: MethodologyField;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  onUpdate: (f: MethodologyField, patch: { label?: string; options?: string[] | null }) => Promise<void>;
  onRenameOption: (f: MethodologyField, oldValue: string, newValue: string) => Promise<number>;
  setNotice: (msg: string | null) => void;
}) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState("");

  const options = field.options ?? [];

  function commitRename() {
    const oldValue = renaming;
    const next = renameDraft.trim();
    if (!oldValue) return;
    if (!next || next === oldValue) {
      setRenaming(null);
      return;
    }
    void run(async () => {
      const migrated = await onRenameOption(field, oldValue, next);
      setRenaming(null);
      setNotice(t("tradeForm.optionRenamed", { count: migrated }));
    });
  }

  function commitAdd() {
    const next = addDraft.trim();
    if (!next) return;
    if (options.some((o) => o.toLowerCase() === next.toLowerCase())) return;
    void run(async () => {
      await onUpdate(field, { options: [...options, next] });
      setAddDraft("");
      setAdding(false);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[11px] text-muted">{t("methodology.fieldOptions")}</label>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((opt) =>
          renaming === opt ? (
            <span key={opt} className="flex items-center gap-1">
              <input
                type="text"
                value={renameDraft}
                disabled={busy}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRename();
                  }
                  if (e.key === "Escape") setRenaming(null);
                }}
                autoFocus
                className="input py-1 text-sm w-36"
              />
              <button
                type="button"
                onClick={commitRename}
                disabled={busy || !renameDraft.trim()}
                aria-label={t("methodology.save")}
                className="p-1.5 rounded-md bg-gold text-on-gold disabled:opacity-40"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={() => setRenaming(null)}
                disabled={busy}
                aria-label={t("methodology.cancel")}
                className="p-1.5 rounded-md border border-border text-muted hover:text-ink"
              >
                <X size={12} />
              </button>
            </span>
          ) : (
            <span
              key={opt}
              className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full border border-border-soft font-mono text-xs text-ink"
            >
              {opt}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRenaming(opt);
                  setRenameDraft(opt);
                  setNotice(null);
                }}
                aria-label={t("tradeForm.renameOption", { value: opt })}
                title={t("tradeForm.renameOption", { value: opt })}
                className="p-0.5 rounded-full hover:bg-ink/5 text-muted hover:text-ink"
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                disabled={busy || options.length <= 1}
                onClick={() => void run(() => onUpdate(field, { options: options.filter((o) => o !== opt) }))}
                aria-label={options.length <= 1 ? t("tradeForm.lastOptionLocked") : t("settings.removeOption", { value: opt })}
                title={options.length <= 1 ? t("tradeForm.lastOptionLocked") : t("settings.removeOption", { value: opt })}
                className="p-0.5 rounded-full hover:bg-ink/5 text-muted hover:text-loss disabled:opacity-30"
              >
                <X size={11} />
              </button>
            </span>
          )
        )}
        {adding ? (
          <span className="flex items-center gap-1">
            <input
              type="text"
              value={addDraft}
              disabled={busy}
              onChange={(e) => setAddDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAdd();
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setAddDraft("");
                }
              }}
              placeholder={t("tradeForm.newOptionPlaceholder")}
              autoFocus
              className="input py-1 text-sm w-36"
            />
            <button
              type="button"
              onClick={commitAdd}
              disabled={busy || !addDraft.trim()}
              aria-label={t("settings.add")}
              className="p-1.5 rounded-md bg-gold text-on-gold disabled:opacity-40"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setAddDraft("");
              }}
              disabled={busy}
              aria-label={t("methodology.cancel")}
              className="p-1.5 rounded-md border border-border text-muted hover:text-ink"
            >
              <X size={12} />
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-border font-mono text-xs text-muted hover:border-gold hover:text-ink"
          >
            <Plus size={11} /> {t("settings.add")}
          </button>
        )}
      </div>
    </div>
  );
}

function ConfirmDeleteRow({
  field,
  busy,
  error,
  run,
  onDelete,
  onCancel,
}: {
  field: MethodologyField;
  busy: boolean;
  error: string | null;
  run: (fn: () => Promise<void>) => Promise<void>;
  onDelete: (f: MethodologyField) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 py-2.5">
      <p className="font-body text-sm text-ink">
        {t("tradeForm.deleteFieldConfirm", { label: fieldLabel(t, field) })}
      </p>
      <p className="font-mono text-[11px] text-muted">{t("tradeForm.deleteFieldNote")}</p>
      {error && <p className="font-mono text-[11px] text-loss">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => onDelete(field))}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-sm font-medium bg-loss text-white disabled:opacity-40"
        >
          <Trash2 size={14} /> {t("common.delete")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-sm text-muted border border-border hover:text-ink"
        >
          <X size={14} /> {t("methodology.cancel")}
        </button>
      </div>
    </div>
  );
}

/**
 * Mini "+ veld toevoegen" for while the form is open: label + type (+ options for
 * an enum). Required/group/conditions/reorder stay in Settings ("Journal & velden")
 * on purpose — this is for the "I want to track this too" moment mid-logging.
 * The new input appears in the section straight away (optimistic append in
 * useMethodology.addField); already-entered form values are untouched.
 */
function InlineAddField({
  allFields,
  onAdd,
}: {
  allFields: MethodologyField[];
  onAdd: (input: InlineFieldInput) => Promise<MethodologyField>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<MethodologyField["field_type"]>("boolean");
  const [optionsRaw, setOptionsRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same guards as the Settings editor: readable duplicate-key message instead of
  // a raw DB constraint error, and an enum needs at least one option.
  const duplicateKey = label.trim().length > 0 && allFields.some((f) => f.field_key === slugifyFieldKey(label));
  const canSave =
    label.trim().length > 0 && !duplicateKey && (fieldType !== "enum" || parseFieldOptions(optionsRaw).length > 0);

  function reset() {
    setOpen(false);
    setLabel("");
    setFieldType("boolean");
    setOptionsRaw("");
    setError(null);
  }

  async function submit() {
    if (!canSave || saving) return;
    setError(null);
    setSaving(true);
    try {
      await onAdd({
        field_key: slugifyFieldKey(label),
        label: label.trim(),
        field_type: fieldType,
        options: fieldType === "enum" ? parseFieldOptions(optionsRaw) : null,
      });
      reset();
    } catch (err) {
      setError(toErrorMessage(err, t("tradeForm.addFieldFailed")));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-sm text-muted border border-dashed border-border hover:border-gold hover:text-ink"
      >
        <Plus size={14} /> {t("tradeForm.addField")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-soft p-3">
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1 flex-1 min-w-[10rem]">
          <label className="font-mono text-[11px] text-muted">{t("methodology.fieldLabel")}</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              // Enter in this mini-form adds the field — never submit the whole trade.
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={t("methodology.labelPlaceholder")}
            className="input"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[11px] text-muted">{t("methodology.fieldType")}</label>
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as MethodologyField["field_type"])}
            className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
          >
            {FIELD_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {t(`methodology.type_${ft}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {duplicateKey && <p className="font-mono text-[10px] text-loss">{t("methodology.duplicateKey")}</p>}

      {fieldType === "enum" && (
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[11px] text-muted">{t("methodology.fieldOptions")}</label>
          <input
            type="text"
            value={optionsRaw}
            onChange={(e) => setOptionsRaw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={t("methodology.optionsPlaceholder")}
            className="input"
          />
          <p className="font-mono text-[10px] text-muted">{t("methodology.fieldOptionsHint")}</p>
        </div>
      )}

      {error && <p className="font-mono text-[11px] text-loss">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40"
        >
          <Check size={14} /> {t("methodology.add")}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-sm text-muted border border-border hover:text-ink"
        >
          <X size={14} /> {t("methodology.cancel")}
        </button>
        <span className="font-mono text-[10px] text-muted">{t("tradeForm.addFieldSettingsHint")}</span>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  control,
  register,
}: {
  field: MethodologyField;
  control: ReturnType<typeof useFormContext<TradeFormValues>>["control"];
  register: ReturnType<typeof useFormContext<TradeFormValues>>["register"];
}) {
  const name = `custom.${field.field_key}` as const;

  switch (field.field_type) {
    case "boolean":
      return (
        <Controller
          name={name}
          control={control}
          render={({ field: f }) => (
            <BooleanToggle value={f.value as boolean | null | undefined} onChange={f.onChange} />
          )}
        />
      );
    case "enum":
      return <EnumSelect options={field.options ?? []} {...register(name)} />;
    case "number":
      return <input type="number" step="any" className="input" {...register(name, { valueAsNumber: true })} />;
    case "date":
      return <input type="date" className="input" {...register(name)} />;
    default: // text
      return <input type="text" className="input" {...register(name)} />;
  }
}
