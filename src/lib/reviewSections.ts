import type { TFunction } from "i18next";
import type { PeriodType } from "@/lib/constants";
import type {
  PeriodicReview,
  ReviewContentBag,
  ReviewKind,
  ReviewSectionInputType,
  ReviewSectionRow,
  WeeklyReview,
} from "@/lib/types";

/**
 * Per-journal configurable review sections (Fase N5, 0048) — the review-side
 * mirror of the methodology_fields / fieldBlocks machinery for trades.
 *
 * A journal either uses the built-in default set (no review_sections rows for
 * that kind → the catalogues below) or its own explicit, ordered list (any rows
 * → they fully replace the defaults). A built-in section key maps to a real
 * review column (verhalen/technisch/…); every other key stores its value in the
 * review's `content` jsonb bag, exactly like trades.custom.
 *
 * This module is pure (no React, no Supabase) so the form, the read-only display,
 * the PDF adapter, the public share view and the admin view all resolve sections
 * and read/write values through one source of truth.
 */

/** Presentation treatment of a section in the read-only display + PDF. */
export type ReviewSectionStyle = "text" | "voice" | "takeaway" | "overall" | "list";

/** A fully resolved review section, ready to render in a form or a display. */
export interface ReviewSection {
  /** section_key — for built-ins this is the backing review column name. */
  key: string;
  /** The stored free-text label (a custom section's own wording, or "" for a default where labelKey wins). */
  label: string;
  /** Render-time i18n key; null for user-custom sections. See reviewSectionLabel(). */
  labelKey: string | null;
  inputType: ReviewSectionInputType;
  style: ReviewSectionStyle;
  /** Textarea rows in the form (list sections ignore this). */
  rows: number;
  /** Optional guiding-question i18n key shown under the label in the form. */
  hintKey?: string;
  /** True = value lives in a real review column; false = in review.content[key]. */
  builtin: boolean;
}

/** Built-in section keys backed by real review columns (never stored in the content bag). */
export const WEEKLY_BUILTIN_KEYS = new Set([
  "verhalen",
  "technisch",
  "mentaal_owner",
  "mentaal_trader",
  "acties",
  "takeaway",
  "overall_comment",
]);
export const PERIODIC_BUILTIN_KEYS = new Set([
  "technisch",
  "mentaal_owner",
  "mentaal_trader",
  "acties",
  "takeaway",
  "overall_comment",
  "periode_overzicht",
]);

export function builtinKeysFor(kind: ReviewKind): Set<string> {
  return kind === "weekly" ? WEEKLY_BUILTIN_KEYS : PERIODIC_BUILTIN_KEYS;
}

/** A default-catalogue entry — the shape of a built-in section before it's resolved. */
interface CatalogueEntry {
  key: string;
  /** Full i18n key (e.g. "reviewContent.mentaal"). */
  labelKey: string;
  inputType: ReviewSectionInputType;
  style: ReviewSectionStyle;
  rows: number;
  hintKey?: string;
  /** Periodic only: show this default section only for these period types. Absent = all. */
  periods?: PeriodType[];
  /** Periodic only: the label key depends on the period type (periode_overzicht). */
  labelKeyByPeriod?: Partial<Record<PeriodType, string>>;
}

/**
 * The weekly default set — the neutral, merged review (Fase F). Matches exactly
 * what ReviewContentFields / ReviewContentDisplay rendered before N5, so a journal
 * that never touches its config sees no change. mentaal_trader is a retired legacy
 * column, preserved but not a default section; the weekly display merges any
 * legacy text into the single "mentaal" block (see readSectionDisplayText).
 */
const DEFAULT_WEEKLY: CatalogueEntry[] = [
  { key: "verhalen", labelKey: "reviewContent.verhalenNeutral", inputType: "text", style: "text", rows: 3, hintKey: "reviewContent.verhalenNeutralHint" },
  { key: "technisch", labelKey: "reviewContent.technisch", inputType: "text", style: "text", rows: 3 },
  { key: "mentaal_owner", labelKey: "reviewContent.mentaal", inputType: "text", style: "voice", rows: 4 },
  { key: "acties", labelKey: "reviewContent.acties", inputType: "list", style: "list", rows: 1 },
  { key: "takeaway", labelKey: "reviewContent.takeaway", inputType: "text", style: "takeaway", rows: 2 },
  { key: "overall_comment", labelKey: "reviewContent.overallComment", inputType: "text", style: "overall", rows: 2 },
];

/**
 * The periodic default set — the same underlying columns relabelled per period
 * (synthesis rather than the weekly technisch/mentaal split). periode_overzicht is
 * shown only for quarter/year (no shorter sub-period to recap for a month), and
 * its label follows the period type.
 */
const DEFAULT_PERIODIC: CatalogueEntry[] = [
  { key: "technisch", labelKey: "reviewContent.genomenTrades", inputType: "text", style: "text", rows: 3 },
  { key: "mentaal_owner", labelKey: "reviewContent.genomenTradesErrors", inputType: "text", style: "text", rows: 3 },
  { key: "mentaal_trader", labelKey: "reviewContent.gemisteTrades", inputType: "text", style: "text", rows: 3 },
  { key: "acties", labelKey: "reviewContent.werkpunten", inputType: "list", style: "list", rows: 1 },
  { key: "takeaway", labelKey: "reviewContent.conclusie", inputType: "text", style: "takeaway", rows: 3 },
  {
    key: "periode_overzicht",
    labelKey: "reviewContent.maandoverzicht",
    labelKeyByPeriod: { quarter: "reviewContent.maandoverzicht", year: "reviewContent.kwartaaloverzicht" },
    periods: ["quarter", "year"],
    inputType: "text",
    style: "text",
    rows: 4,
  },
  { key: "overall_comment", labelKey: "reviewContent.overallComment", inputType: "text", style: "overall", rows: 2 },
];

function catalogueFor(kind: ReviewKind): CatalogueEntry[] {
  return kind === "weekly" ? DEFAULT_WEEKLY : DEFAULT_PERIODIC;
}

function entryToSection(e: CatalogueEntry, periodType?: PeriodType): ReviewSection {
  const labelKey = (periodType && e.labelKeyByPeriod?.[periodType]) || e.labelKey;
  return { key: e.key, label: "", labelKey, inputType: e.inputType, style: e.style, rows: e.rows, hintKey: e.hintKey, builtin: true };
}

/**
 * The built-in default sections for a review kind. `periodType` filters and
 * relabels the periodic set (periode_overzicht). Used when a journal has no
 * custom rows.
 */
export function defaultReviewSections(kind: ReviewKind, periodType?: PeriodType): ReviewSection[] {
  return catalogueFor(kind)
    .filter((e) => !e.periods || (periodType != null && e.periods.includes(periodType)))
    .map((e) => entryToSection(e, periodType));
}

/**
 * The full built-in section set for a kind, unfiltered by period — used by the
 * Settings editor to materialize the defaults into editable rows when a user first
 * customizes a journal. Periodic includes periode_overzicht so its column mapping
 * (and any existing content) is preserved once customized.
 */
export function allDefaultSections(kind: ReviewKind): ReviewSection[] {
  return catalogueFor(kind).map((e) => entryToSection(e));
}

/**
 * Resolve a journal's review sections for one kind: its own ordered rows if it has
 * any, otherwise the built-in defaults. A custom row that reuses a built-in key
 * inherits that key's presentation (style/rows) from the catalogue; a genuinely
 * custom key derives its style from its input type.
 */
export function resolveReviewSections(
  kind: ReviewKind,
  rows: ReviewSectionRow[] | null | undefined,
  periodType?: PeriodType
): ReviewSection[] {
  const own = (rows ?? []).filter((r) => r.review_kind === kind);
  if (own.length === 0) return defaultReviewSections(kind, periodType);
  return mapSourcesToSections(kind, own);
}

/** The fields any section source needs — satisfied by both a DB row and a share-payload section. */
export interface ReviewSectionSource {
  section_key: string;
  label: string;
  label_key: string | null;
  input_type: ReviewSectionInputType;
  sort_order: number;
}

/** Map already-kind-scoped section sources onto resolved sections (shared by the DB and share paths). */
function mapSourcesToSections(kind: ReviewKind, sources: ReviewSectionSource[]): ReviewSection[] {
  const builtins = builtinKeysFor(kind);
  const catalogueByKey = new Map(catalogueFor(kind).map((e) => [e.key, e] as const));
  return [...sources]
    .sort((a, b) => a.sort_order - b.sort_order || a.section_key.localeCompare(b.section_key))
    .map((r) => {
      const builtin = builtins.has(r.section_key);
      const cat = builtin ? catalogueByKey.get(r.section_key) : undefined;
      const style: ReviewSectionStyle = cat?.style ?? (r.input_type === "list" ? "list" : "text");
      return {
        key: r.section_key,
        label: r.label,
        labelKey: r.label_key,
        inputType: r.input_type,
        style,
        rows: cat?.rows ?? (r.input_type === "list" ? 1 : 3),
        hintKey: cat?.hintKey,
        builtin,
      } satisfies ReviewSection;
    });
}

/**
 * Resolve sections from a share payload (Fase N5) — the RPC already filtered by
 * kind, so an empty list means "use the built-in defaults", exactly like the
 * owner's own unconfigured journal.
 */
export function resolveSharedReviewSections(
  kind: ReviewKind,
  sources: ReviewSectionSource[] | null | undefined,
  periodType?: PeriodType
): ReviewSection[] {
  const list = sources ?? [];
  if (list.length === 0) return defaultReviewSections(kind, periodType);
  return mapSourcesToSections(kind, list);
}

/**
 * The display label of a section: the translated built-in key, or the user's own
 * free text. Accepts both the resolved shape (labelKey) and a raw DB row
 * (label_key) so callers can pass either without converting first.
 */
export function reviewSectionLabel(
  t: TFunction,
  section: { label: string; labelKey?: string | null; label_key?: string | null }
): string {
  const key = section.labelKey ?? section.label_key ?? null;
  if (!key) return section.label;
  return t(key, { defaultValue: section.label });
}

// ---------------------------------------------------------------------------
// Value read/write — one bridge between resolved sections and the DB shape.
// ---------------------------------------------------------------------------

/** The minimal review shape a value reader needs — every built-in column plus the content bag, all optional. */
export type ReviewValueSource = Partial<{
  verhalen: string | null;
  technisch: string | null;
  mentaal_owner: string | null;
  mentaal_trader: string | null;
  acties: string[] | null;
  takeaway: string | null;
  overall_comment: string | null;
  periode_overzicht: string | null;
  content: ReviewContentBag | null;
}>;

const TEXT_COLUMN_KEYS = new Set(["verhalen", "technisch", "mentaal_owner", "mentaal_trader", "takeaway", "overall_comment", "periode_overzicht"]);

/** Read a text section's raw stored value (no display merging — see readSectionDisplayText for that). */
export function readSectionText(source: ReviewValueSource, section: Pick<ReviewSection, "key" | "builtin">): string {
  if (section.builtin && TEXT_COLUMN_KEYS.has(section.key)) {
    const v = (source as Record<string, unknown>)[section.key];
    return typeof v === "string" ? v : "";
  }
  const v = source.content?.[section.key];
  return typeof v === "string" ? v : "";
}

/** Read a list section's items (the built-in `acties` column, or a custom list in the content bag). */
export function readSectionList(source: ReviewValueSource, section: Pick<ReviewSection, "key" | "builtin">): string[] {
  if (section.builtin && section.key === "acties") return source.acties ?? [];
  const v = source.content?.[section.key];
  return Array.isArray(v) ? v : [];
}

/**
 * The text to *display* for a section. Identical to readSectionText except the
 * weekly built-in "mentaal_owner" block also folds in any legacy mentaal_trader
 * text, preserving how old two-voice WPM reviews render (Fase F). Periodic reviews
 * use mentaal_trader as its own section, so the merge is weekly-only.
 */
export function readSectionDisplayText(
  kind: ReviewKind,
  source: ReviewValueSource,
  section: Pick<ReviewSection, "key" | "builtin">
): string {
  if (kind === "weekly" && section.builtin && section.key === "mentaal_owner") {
    return [source.mentaal_owner, source.mentaal_trader]
      .map((v) => v?.trim())
      .filter(Boolean)
      .join("\n\n");
  }
  return readSectionText(source, section);
}

/** Form state: a section value keyed by section.key — a string for text sections, a string[] for list sections. */
export type ReviewValues = Record<string, string | string[]>;

/** Seed the form values for a set of sections from an existing review (or blanks for a new one). */
export function initialReviewValues(sections: ReviewSection[], existing?: ReviewValueSource | null): ReviewValues {
  const values: ReviewValues = {};
  for (const s of sections) {
    if (s.inputType === "list") {
      const items = existing ? readSectionList(existing, s) : [];
      // Show one empty row so the list isn't a bare "add" button on a fresh review.
      values[s.key] = items.length ? items : [""];
    } else {
      values[s.key] = existing ? readSectionText(existing, s) : "";
    }
  }
  return values;
}

const WEEKLY_COLUMN_DEFAULTS = ["verhalen", "technisch", "mentaal_owner", "mentaal_trader", "takeaway", "overall_comment"] as const;
const PERIODIC_COLUMN_DEFAULTS = ["technisch", "mentaal_owner", "mentaal_trader", "takeaway", "overall_comment", "periode_overzicht"] as const;

/** The built-in column payload for a weekly review plus its custom-section content bag. */
export interface WeeklyReviewContent {
  verhalen: string | null;
  technisch: string | null;
  mentaal_owner: string | null;
  mentaal_trader: string | null;
  acties: string[];
  takeaway: string | null;
  overall_comment: string | null;
  content: ReviewContentBag;
}

export interface PeriodicReviewContent {
  technisch: string | null;
  mentaal_owner: string | null;
  mentaal_trader: string | null;
  acties: string[];
  takeaway: string | null;
  overall_comment: string | null;
  periode_overzicht: string | null;
  content: ReviewContentBag;
}

/**
 * Fold form values back into the DB shape. Non-visible built-in columns and
 * content keys are seeded from the existing review first, so hiding a section
 * never wipes its stored data — only the currently-shown sections are overwritten.
 */
function applyValues(
  sections: ReviewSection[],
  values: ReviewValues,
  columns: Record<string, string | string[] | null>,
  content: ReviewContentBag
): void {
  for (const s of sections) {
    if (s.inputType === "list") {
      const raw = values[s.key];
      const items = (Array.isArray(raw) ? raw : []).map((a) => a.trim()).filter(Boolean);
      if (s.builtin && s.key === "acties") columns.acties = items;
      else if (s.builtin) columns[s.key] = items.length ? items.join("\n") : null; // list stored in a text column (custom reuse) — join lines
      else content[s.key] = items;
    } else {
      const raw = values[s.key];
      const text = typeof raw === "string" ? raw : "";
      if (s.builtin) columns[s.key] = text || null;
      else if (text) content[s.key] = text;
      else delete content[s.key];
    }
  }
}

export function buildWeeklyReviewContent(
  sections: ReviewSection[],
  values: ReviewValues,
  existing?: WeeklyReview | null
): WeeklyReviewContent {
  const columns: Record<string, string | string[] | null> = {};
  for (const k of WEEKLY_COLUMN_DEFAULTS) columns[k] = existing?.[k] ?? null;
  columns.acties = existing?.acties ?? [];
  const content: ReviewContentBag = { ...(existing?.content ?? {}) };
  applyValues(sections, values, columns, content);
  return {
    verhalen: (columns.verhalen as string | null) ?? null,
    technisch: (columns.technisch as string | null) ?? null,
    mentaal_owner: (columns.mentaal_owner as string | null) ?? null,
    mentaal_trader: (columns.mentaal_trader as string | null) ?? null,
    acties: (columns.acties as string[]) ?? [],
    takeaway: (columns.takeaway as string | null) ?? null,
    overall_comment: (columns.overall_comment as string | null) ?? null,
    content,
  };
}

export function buildPeriodicReviewContent(
  sections: ReviewSection[],
  values: ReviewValues,
  existing?: PeriodicReview | null
): PeriodicReviewContent {
  const columns: Record<string, string | string[] | null> = {};
  for (const k of PERIODIC_COLUMN_DEFAULTS) columns[k] = existing?.[k] ?? null;
  columns.acties = existing?.acties ?? [];
  const content: ReviewContentBag = { ...(existing?.content ?? {}) };
  applyValues(sections, values, columns, content);
  return {
    technisch: (columns.technisch as string | null) ?? null,
    mentaal_owner: (columns.mentaal_owner as string | null) ?? null,
    mentaal_trader: (columns.mentaal_trader as string | null) ?? null,
    acties: (columns.acties as string[]) ?? [],
    takeaway: (columns.takeaway as string | null) ?? null,
    overall_comment: (columns.overall_comment as string | null) ?? null,
    periode_overzicht: (columns.periode_overzicht as string | null) ?? null,
    content,
  };
}

/** Slugify a free-text section label into a stable section_key (mirrors slugifyFieldKey). */
export function slugifySectionKey(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "sectie"
  );
}
