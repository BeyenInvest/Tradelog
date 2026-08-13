import { LEGACY_METHODOLOGY_FIELD_KEYS } from "./constants";
import type { MethodologyField } from "./types";

/**
 * Shared logic over a methodology's field list (Scope C): which fields the
 * dynamic form/analysis own, which are visible given the current answers, and
 * which required ones are still unanswered. Pure — one source of truth for
 * CustomFieldsSection (render), TradeForm (submit enforcement),
 * customFieldDimensions (analysis) and MethodologyEditor (legacy lock), so the
 * four can never drift apart on what counts as "a custom field".
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

/** A journal is legacy iff it carries the seeded WPM `fase` field — same heuristic as useMethodology.isLegacyMethodology. */
export function isLegacyFieldList(fields: MethodologyField[]): boolean {
  return fields.some((f) => f.field_key === "fase");
}

/**
 * True for a field the hardcoded legacy WPM form/analysis still owns (real
 * trades.* columns) — only on a legacy journal. On a non-WPM journal the same
 * key is just a user field ("Structuur", "Engulfing candle", …) and must NOT be
 * excluded, or it would silently render nowhere.
 */
export function isLockedLegacyField(field: MethodologyField, allFields: MethodologyField[]): boolean {
  return isLegacyFieldList(allFields) && LEGACY_METHODOLOGY_FIELD_KEYS.has(field.field_key);
}

/** The fields the dynamic custom-field form/analysis own: everything except computed and locked-legacy fields. */
export function dynamicMethodologyFields(fields: MethodologyField[]): MethodologyField[] {
  const legacy = isLegacyFieldList(fields);
  return fields.filter((f) => !f.is_computed && !(legacy && LEGACY_METHODOLOGY_FIELD_KEYS.has(f.field_key)));
}

/**
 * Whether a field is currently visible given its show_when condition. `fase` is
 * the only legacy parent living outside the custom bag, hence the separate
 * faseValue. A dangling parent reference (parent deleted) means always-show.
 */
export function isFieldVisible(
  field: MethodologyField,
  allFields: MethodologyField[],
  faseValue: unknown,
  custom: Record<string, unknown>
): boolean {
  if (!field.show_when_field_id || !field.show_when_values || field.show_when_values.length === 0) return true;
  const parent = allFields.find((p) => p.id === field.show_when_field_id);
  if (!parent) return true;
  const parentValue = parent.field_key === "fase" ? faseValue : custom[parent.field_key];
  return field.show_when_values.includes(String(parentValue ?? ""));
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
  faseValue: unknown,
  custom: Record<string, unknown>
): MethodologyField[] {
  return dynamicMethodologyFields(fields).filter(
    (f) => f.required && isFieldVisible(f, fields, faseValue, custom) && isBlank(custom[f.field_key])
  );
}
