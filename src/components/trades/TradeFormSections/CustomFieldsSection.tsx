import { useEffect } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import type { MethodologyField } from "@/lib/types";
import { useMethodology } from "@/hooks/useMethodology";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { Field } from "./Field";

/**
 * Field keys still owned by the legacy hardcoded form (the fase <select> in
 * EntrySection + FaseKenmerkenSection, backed by real trades.* columns). The
 * dynamic section skips them so Weekly Phase Method users never see them twice and their data
 * path stays unchanged. This bridge disappears in cyclus 10, when those columns
 * are dropped and every field becomes fully dynamic.
 */
const LEGACY_FIELD_KEYS = new Set([
  "fase",
  "daily_respecteert_zone",
  "spelers_verleden",
  "structuur",
  "zone_min_2_touches",
  "engulfing_candle",
  "beide",
  "weekly_bevestigingscandle",
]);

/** Consecutive fields sharing a group_label render under one subheading (fields come sort-ordered). */
function groupFields(fields: MethodologyField[]): { label: string | null; fields: MethodologyField[] }[] {
  const groups: { label: string | null; fields: MethodologyField[] }[] = [];
  for (const f of fields) {
    const g = f.group_label ?? null;
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
  const { fields } = useMethodology();
  const { control, register, watch, setValue } = useFormContext<TradeFormValues>();

  const fase = watch("fase");
  const customVals = (watch("custom") ?? {}) as Record<string, unknown>;

  const dynamicFields = fields.filter((f) => !LEGACY_FIELD_KEYS.has(f.field_key) && !f.is_computed);

  function valueOfParent(parent: MethodologyField): unknown {
    // The only legacy field that can be an enum parent is `fase` (a core column);
    // every other parent is itself a custom field living in the bag.
    return parent.field_key === "fase" ? fase : customVals[parent.field_key];
  }

  function isVisible(f: MethodologyField): boolean {
    if (!f.show_when_field_id || !f.show_when_values || f.show_when_values.length === 0) return true;
    const parent = fields.find((p) => p.id === f.show_when_field_id);
    if (!parent) return true; // dangling reference (parent deleted) → always show
    return f.show_when_values.includes(String(valueOfParent(parent) ?? ""));
  }

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

  if (dynamicFields.length === 0) return null;

  const visibleFields = dynamicFields.filter(isVisible);
  if (visibleFields.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.customSectionHeading")}</h3>
      {groupFields(visibleFields).map((group, gi) => (
        <div key={group.label ?? `g${gi}`} className="flex flex-col gap-2">
          {group.label && (
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{group.label}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            {group.fields.map((f) => (
              <Field key={f.id} label={f.label} required={f.required}>
                <FieldInput field={f} control={control} register={register} />
              </Field>
            ))}
          </div>
        </div>
      ))}
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
