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
  return field.show_when_values.includes(String(custom[parent.field_key] ?? ""));
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
    (f) => f.required && isFieldVisible(f, fields, custom) && isBlank(custom[f.field_key])
  );
}
