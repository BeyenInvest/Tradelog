import type { MethodologyField } from "./types";

/**
 * Shared logic over a methodology's field list (Scope C): which fields the
 * dynamic form/analysis own, which are visible given the current answers, and
 * which required ones are still unanswered. Pure — one source of truth for
 * CustomFieldsSection (render), TradeForm (submit enforcement) and
 * customFieldDimensions (analysis), so they can never drift apart on what counts
 * as "a custom field". Since the fase-retirement (0059) every journal — the WPM
 * template included — is fully config-driven; there is no hardcoded/legacy field
 * carve-out anymore.
 */

/** label -> stable field_key (lowercase, underscores) — shared by the Settings editor and the inline add-field in the trade form. */
export function slugifyFieldKey(s: string): string {
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
export function parseFieldOptions(raw: string): string[] {
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

/** The fields the dynamic custom-field form/analysis own: everything except computed fields. */
export function dynamicMethodologyFields(fields: MethodologyField[]): MethodologyField[] {
  return fields.filter((f) => !f.is_computed);
}

/** A boolean field shown as a checkbox (0066) — a flag: unticked means "no". */
export function isCheckboxField(field: Pick<MethodologyField, "field_type" | "checkbox">): boolean {
  return field.field_type === "boolean" && field.checkbox === true;
}

/** field_keys of the checkbox-style fields — what applyJournalFilters needs to read empty as "Nee". */
export function checkboxFieldKeys(fields: MethodologyField[]): Set<string> {
  return new Set(fields.filter(isCheckboxField).map((f) => f.field_key));
}

/**
 * The effective answer of a boolean field. A checkbox has no "unanswered"
 * state — an empty box (also a missing value, e.g. on an imported trade or one
 * logged before the field existed) reads as `false`, so every trade lands in
 * the Ja/Nee analysis. The Ja/Nee-toggle keeps `null` = unanswered.
 */
export function booleanFieldValue(
  field: Pick<MethodologyField, "field_type" | "checkbox">,
  raw: unknown
): boolean | null {
  if (isCheckboxField(field)) return raw === true;
  return typeof raw === "boolean" ? raw : null;
}

/**
 * Whether a field is currently visible given its show_when condition, read
 * against the trade's `custom` bag (every field, incl. fase, lives there since
 * the fase-retirement 0059). A dangling parent reference (parent deleted) means
 * always-show.
 */
export function isFieldVisible(
  field: MethodologyField,
  allFields: MethodologyField[],
  custom: Record<string, unknown>
): boolean {
  if (!field.show_when_field_id || !field.show_when_values || field.show_when_values.length === 0) return true;
  const parent = allFields.find((p) => p.id === field.show_when_field_id);
  if (!parent) return true;
  const raw = isCheckboxField(parent) ? booleanFieldValue(parent, custom[parent.field_key]) : custom[parent.field_key];
  return field.show_when_values.includes(String(raw ?? ""));
}

/** Unanswered = missing, empty string, or NaN. `false` is a real boolean answer. */
function isBlank(v: unknown): boolean {
  return v == null || v === "" || (typeof v === "number" && Number.isNaN(v));
}

/**
 * The visible, required custom fields that are still unanswered — the submit-time
 * enforcement the static tradeSchema can't do (the valid set is per-journal).
 * Hidden-by-condition fields are never required: their value is cleared anyway.
 */
export function missingRequiredCustomFields(
  fields: MethodologyField[],
  custom: Record<string, unknown>
): MethodologyField[] {
  return dynamicMethodologyFields(fields).filter(
    // A checkbox is never "unanswered" (empty = no), so required never blocks it.
    (f) => f.required && !isCheckboxField(f) && isFieldVisible(f, fields, custom) && isBlank(custom[f.field_key])
  );
}
