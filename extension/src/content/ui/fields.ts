// Beslislogica van de dynamische form (F2d): welke velden het paneel bezit,
// welke zichtbaar zijn (show_when), welke verplichte nog leeg zijn en wat er
// uiteindelijk in de custom-bag belandt. Pure module — form.ts rendert alleen
// wat hier uitkomt, zodat dezelfde regels als de web-form testbaar blijven.
import {
  CCS, ENTRIES, FASE_KENMERKEN, LEGACY_METHODOLOGY_FIELD_KEYS, TRADE_CONCEPTS,
  WEEKLY_CRITERIA, WEEKLY_KENMERKEN,
} from "../../../../src/lib/constants";
import type { LegacyTradeColumn } from "../../../../src/lib/tradePayload";
import type { JournalField } from "../../db";

export type FormValues = Record<string, unknown>;

/** Een journal is legacy-WPM zodra het het gezaaide `fase`-veld draagt —
 * zelfde heuristiek als isLegacyFieldList in de web-app. */
export function isLegacyJournal(fields: JournalField[]): boolean {
  return fields.some((f) => f.fieldKey === "fase");
}

/** Toegestane enum-waarden; alles wat geen string-lijst is degradeert naar leeg. */
export function fieldOptions(field: JournalField | undefined): string[] {
  const raw = field?.options;
  if (!Array.isArray(raw)) return [];
  return raw.filter((o): o is string => typeof o === "string" && o !== "");
}

function showWhenValues(field: JournalField): string[] {
  const raw = field.showWhenValues;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v));
}

/** De fase-opties van een legacy journal (het gezaaide `fase`-veld draagt ze). */
export function faseOptions(allFields: JournalField[]): string[] {
  return fieldOptions(allFields.find((f) => f.fieldKey === "fase"));
}

/** De default-fase wanneer de user (nog) niets koos: de eerste journal-optie,
 * anders dezelfde stille "Fase 1" als quick-log. */
export function faseValue(allFields: JournalField[]): string {
  return faseOptions(allFields)[0] ?? "Fase 1";
}

/**
 * De velden waar het paneel de eigenaar van is: op sortOrder, zonder computed,
 * zonder `fase` (server-side gezet) en — op een legacy journal — zonder de
 * WPM-kenmerken, want die horen in echte trades.*-kolommen en niet in de
 * custom-bag. Zelfde afbakening als dynamicMethodologyFields in de web-app.
 */
export function formFields(allFields: JournalField[]): JournalField[] {
  const legacy = isLegacyJournal(allFields);
  return allFields
    .filter(
      (f) =>
        !f.isComputed &&
        f.fieldKey !== "fase" &&
        !(legacy && LEGACY_METHODOLOGY_FIELD_KEYS.has(f.fieldKey))
    )
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

// ── Legacy-WPM-velden (spiegel van EntrySection/TechnicalSection/
// FaseKenmerkenSection) ──────────────────────────────────────────────────────
// Deze velden bestaan niet (entry/cc/…) of half (kenmerken) in
// methodology_fields; het paneel rendert ze hardcoded, precies zoals de
// web-form, en hun antwoorden landen via LogTradeRequest.legacy in echte
// trades.*-kolommen. `fase3_beide` is computed en doet dus niet mee.

/** @deprecated sinds de legacy-velden echt renderen; verdwijnt met de uitleg-zin. */
export function skippedLegacyFields(allFields: JournalField[]): JournalField[] {
  if (!isLegacyJournal(allFields)) return [];
  return allFields.filter(
    (f) => !f.isComputed && f.fieldKey !== "fase" && LEGACY_METHODOLOGY_FIELD_KEYS.has(f.fieldKey)
  );
}

export type LegacyFieldSpec =
  | { key: LegacyTradeColumn; kind: "enum"; options: readonly string[] }
  | { key: LegacyTradeColumn; kind: "addable"; options: readonly string[] }
  | { key: LegacyTradeColumn; kind: "boolean" };

/** Het entry-blok: cc, concept, entry (beide addable met custom_options),
 * weekly criteria/kenmerk en nieuws — volgorde = web-form. */
export function legacyEntryFields(): LegacyFieldSpec[] {
  return [
    { key: "cc", kind: "enum", options: CCS },
    { key: "trade_concept", kind: "addable", options: TRADE_CONCEPTS },
    { key: "entry", kind: "addable", options: ENTRIES },
    { key: "weekly_criteria", kind: "enum", options: WEEKLY_CRITERIA },
    { key: "weekly_kenmerk", kind: "enum", options: WEEKLY_KENMERKEN },
    { key: "nieuws", kind: "boolean" },
  ];
}

/** De multi-timeframe-confirms (TechnicalSection). */
export function legacyConfirmFields(): LegacyFieldSpec[] {
  return [
    { key: "w_confirm", kind: "boolean" },
    { key: "d_confirm", kind: "boolean" },
    { key: "h4_confirm", kind: "boolean" },
    { key: "extra_d_conf", kind: "boolean" },
  ];
}

/** De kenmerken van de gekozen fase (FaseKenmerkenSection), zonder computed. */
export function legacyKenmerkFields(fase: string): (LegacyFieldSpec & { label: string })[] {
  return FASE_KENMERKEN.filter((k) => k.fase === fase && !k.computed).map((k) =>
    k.values === "boolean"
      ? { key: k.field as LegacyTradeColumn, kind: "boolean", label: k.label }
      : { key: k.field as LegacyTradeColumn, kind: "enum", options: k.values, label: k.label }
  );
}

/**
 * Wat er als `legacy` de payload in gaat: alle beantwoorde legacy-velden, maar
 * kenmerken alléén van de gekozen fase — een antwoord van een eerder gekozen
 * fase mag niet stilletjes meeliften.
 */
export function legacyFromValues(fase: string, values: FormValues): Record<string, unknown> {
  const allowed = new Set<string>([
    ...legacyEntryFields().map((f) => f.key),
    ...legacyConfirmFields().map((f) => f.key),
    ...legacyKenmerkFields(fase).map((f) => f.key),
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!allowed.has(k) || isBlank(v)) continue;
    out[k] = v;
  }
  return out;
}

/** show_when: zichtbaar zolang de ouder één van de gevraagde waarden heeft. Een
 * verweesde verwijzing (ouder verwijderd) toont altijd — web-app-regel. */
export function isVisible(field: JournalField, allFields: JournalField[], values: FormValues): boolean {
  const wanted = showWhenValues(field);
  if (!field.showWhenFieldId || wanted.length === 0) return true;
  const parent = allFields.find((p) => p.id === field.showWhenFieldId);
  if (!parent) return true;
  // De fase is sinds de legacy-velden een echte keuze in het paneel; zolang er
  // (nog) geen keuze in values zit geldt de default.
  const value =
    parent.fieldKey === "fase" ? (values["fase"] ?? faseValue(allFields)) : values[parent.fieldKey];
  return wanted.includes(String(value ?? ""));
}

/** Onbeantwoord = leeg/NaN; `false` is een echt boolean-antwoord. */
export function isBlank(value: unknown): boolean {
  return value == null || value === "" || (typeof value === "number" && Number.isNaN(value));
}

/** Zichtbare verplichte velden die nog leeg zijn — de submit-blokkade. */
export function missingRequired(
  fields: JournalField[],
  allFields: JournalField[],
  values: FormValues
): JournalField[] {
  return fields.filter(
    (f) => f.required && isVisible(f, allFields, values) && isBlank(values[f.fieldKey])
  );
}

/**
 * Wat er als `custom` meegaat: alleen antwoorden van zichtbare velden. Een
 * antwoord in een tak die je daarna dichtklapt hoort niet mee te liften (de
 * uiteindelijke pruning tot string|number|boolean doet pruneCustom).
 */
export function customFromValues(
  fields: JournalField[],
  allFields: JournalField[],
  values: FormValues
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (!isVisible(f, allFields, values)) continue;
    const v = values[f.fieldKey];
    if (isBlank(v)) continue;
    out[f.fieldKey] = v;
  }
  return out;
}

export interface FieldGroup {
  label: string | null;
  fields: JournalField[];
}

/** Opeenvolgende velden met hetzelfde groupLabel onder één kopje. */
export function groupFields(fields: JournalField[]): FieldGroup[] {
  const groups: FieldGroup[] = [];
  for (const f of fields) {
    const label = f.groupLabel && f.groupLabel.trim() ? f.groupLabel.trim() : null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.fields.push(f);
    else groups.push({ label, fields: [f] });
  }
  return groups;
}
