// Beslislogica van de dynamische form (F2d): welke velden het paneel bezit,
// welke zichtbaar zijn (show_when), welke verplichte nog leeg zijn en wat er
// uiteindelijk in de custom-bag belandt. Pure module — form.ts rendert alleen
// wat hier uitkomt, zodat dezelfde regels als de web-form testbaar blijven.
//
// Sinds de fase-retirement (0059) is er geen aparte WPM-spiegel meer: fase, cc,
// de weekly-velden, de confirms en de fase-kenmerken zijn gewone
// methodology_fields-rijen die het paneel via ditzelfde generieke pad rendert en
// meestuurt (ze landen in trades.custom, net als elk ander custom veld).
import type { JournalField } from "../../db";

export type FormValues = Record<string, unknown>;

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

/**
 * De velden waar het paneel de eigenaar van is: op sortOrder, zonder computed.
 * Alle methodology_fields (incl. fase/cc/… op een WPM-journal) horen hier —
 * zelfde afbakening als dynamicMethodologyFields in de web-app.
 */
export function formFields(allFields: JournalField[]): JournalField[] {
  return allFields
    .filter((f) => !f.isComputed)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/** De 4H-candle-close-slots (sluituren van de 4H-candles in de profiel-tijdzone,
 * zoals compute_sessie ze in schema.sql gebruikt). Sinds de fase-retirement komt
 * de vaste CCS-lijst niet meer uit constants.ts; het paneel houdt 'm lokaal. */
const CC_SLOTS = ["03", "07", "11", "15", "19", "23"] as const;

/**
 * De 4H-candle-close (CC) die bij een entry-tijd hoort. Een entry om 14:32 valt
 * in de candle die om 15:00 sluit. Een entry exact óp een slot (15:00) hoort bij
 * de candle die dan opent (sluit 19:00); na 23:00 sluit de candle pas de
 * volgende dag om 03:00. De caller geeft de wall-clock-tijd in de
 * profiel-tijdzone mee ("HH:MM", zoals wallClockInTimezone en de
 * manual-time-input die leveren).
 */
export function ccFromTime(time: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  const minutes = hour * 60 + minute;
  for (const cc of CC_SLOTS) {
    if (Number(cc) * 60 > minutes) return cc;
  }
  return CC_SLOTS[0];
}

/** show_when: zichtbaar zolang de ouder één van de gevraagde waarden heeft. Een
 * verweesde verwijzing (ouder verwijderd) toont altijd — web-app-regel. */
export function isVisible(field: JournalField, allFields: JournalField[], values: FormValues): boolean {
  const wanted = showWhenValues(field);
  if (!field.showWhenFieldId || wanted.length === 0) return true;
  const parent = allFields.find((p) => p.id === field.showWhenFieldId);
  if (!parent) return true;
  return wanted.includes(String(values[parent.fieldKey] ?? ""));
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
