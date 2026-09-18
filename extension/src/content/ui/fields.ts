// Beslislogica van de dynamische form (F2d): welke velden het paneel bezit,
// welke zichtbaar zijn (show_when), welke verplichte nog leeg zijn en wat er
// uiteindelijk in de custom-bag belandt. Pure module — form.ts rendert alleen
// wat hier uitkomt, zodat dezelfde regels als de web-form testbaar blijven.
import {
  CCS, ENTRIES, FASE_KENMERKEN, LEGACY_METHODOLOGY_FIELD_KEYS, TRADE_CONCEPTS,
  WEEKLY_CRITERIA, WEEKLY_KENMERKEN, type CC,
} from "../../../../src/lib/constants";
import type { LegacyTradeColumn } from "../../../../src/lib/tradePayload";
import type { JournalField } from "../../db";
import type { MessageKey } from "../../i18nExt";

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

export type LegacyFieldSpec =
  | { key: LegacyTradeColumn; kind: "enum"; options: readonly string[] }
  | { key: LegacyTradeColumn; kind: "addable"; options: readonly string[] }
  | { key: LegacyTradeColumn; kind: "boolean" };

/** Het entry-blok: concept, entry (beide addable met custom_options), weekly
 * criteria/kenmerk en nieuws — volgorde = web-form. De CC staat hier bewust
 * niet meer tussen (owner 18-09, "extra clutter"): het paneel leidt 'm
 * onzichtbaar af uit de entry-tijd (ccFromTime) en stuurt 'm rechtstreeks mee. */
export function legacyEntryFields(): LegacyFieldSpec[] {
  return [
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
 * De i18n-sleutel van elk legacy-veld. Een volledige Record over
 * LegacyTradeColumn: een kolom die erbij komt zonder label is een compile-fout,
 * geen rij met een rauwe kolomnaam als label. De NL-zinnen zijn letterlijk de
 * labels van de web-form (de tradeForm- en faseKenmerken-sleutels).
 */
const LEGACY_LABEL_KEYS: Record<LegacyTradeColumn, MessageKey> = {
  cc: "legacy.cc",
  trade_concept: "legacy.tradeConcept",
  entry: "legacy.entry",
  weekly_criteria: "legacy.weeklyCriteria",
  weekly_kenmerk: "legacy.weeklyKenmerk",
  nieuws: "legacy.nieuws",
  w_confirm: "legacy.wConfirm",
  d_confirm: "legacy.dConfirm",
  h4_confirm: "legacy.h4Confirm",
  extra_d_conf: "legacy.extraDConf",
  fase1_daily_respecteert_zone: "legacy.k.fase1_daily_respecteert_zone",
  fase1_spelers_verleden: "legacy.k.fase1_spelers_verleden",
  fase2_daily_respecteert_zone: "legacy.k.fase2_daily_respecteert_zone",
  fase2_structuur: "legacy.k.fase2_structuur",
  fase3_zone_min_2_touches: "legacy.k.fase3_zone_min_2_touches",
  fase3_engulfing_candle: "legacy.k.fase3_engulfing_candle",
  fase3_structuur: "legacy.k.fase3_structuur",
  fase4_weekly_bevestigingscandle: "legacy.k.fase4_weekly_bevestigingscandle",
};

export function legacyLabelKey(key: LegacyTradeColumn): MessageKey {
  return LEGACY_LABEL_KEYS[key];
}

/**
 * De 4H-candle-close (CC) die bij een entry-tijd hoort: de méést recente
 * 4H-close op of vóór de entry (owner 18-09) — de WPM-workflow is "de candle
 * sluit, de close bevestigt, je stapt in", dus een entry om 11:00 (of 14:32)
 * hoort bij CC 11. De CCS-slots zijn de sluituren afgelezen in de
 * profiel-tijdzone (zo gebruikt compute_sessie ze ook, zie schema.sql); vóór
 * 03:00 is de recentste close de 23 van de dag ervoor. De caller geeft de
 * wall-clock-tijd in de profiel-tijdzone mee ("HH:MM", zoals
 * wallClockInTimezone en de manual-time-input die leveren).
 */
export function ccFromTime(time: string): CC | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  const minutes = hour * 60 + minute;
  for (let i = CCS.length - 1; i >= 0; i--) {
    if (Number(CCS[i]) * 60 <= minutes) return CCS[i];
  }
  return CCS[CCS.length - 1];
}

/**
 * De keuzelijst van een addable-veld: de gedeelde vaste lijst plus de eigen
 * custom_options van de user, in die volgorde en zonder dubbels — zelfde merge
 * als AddableSelect in de web-form. Toevoegen/verwijderen blijft daar; het
 * paneel toont alleen wat er al is.
 */
export function addableOptions(base: readonly string[], custom: readonly string[]): string[] {
  const out: string[] = [...base];
  for (const value of custom) {
    if (typeof value === "string" && value !== "" && !out.includes(value)) out.push(value);
  }
  return out;
}

/** De fase die het paneel toont en meestuurt: de keuze van de user, anders de default. */
export function selectedFase(allFields: JournalField[], values: FormValues): string {
  const chosen = values["fase"];
  return typeof chosen === "string" && chosen !== "" ? chosen : faseValue(allFields);
}

/**
 * Wat er als `legacy` de payload in gaat: alle beantwoorde legacy-velden, maar
 * kenmerken alléén van de gekozen fase — een antwoord van een eerder gekozen
 * fase mag niet stilletjes meeliften.
 */
export function legacyFromValues(fase: string, values: FormValues): Record<string, unknown> {
  const allowed = new Set<string>([
    // De CC is geen zichtbaar veld meer maar reist wél mee: het paneel zet 'm
    // machinaal in values (ccFromTime uit de entry-tijd).
    "cc",
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
    parent.fieldKey === "fase" ? selectedFase(allFields, values) : values[parent.fieldKey];
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
