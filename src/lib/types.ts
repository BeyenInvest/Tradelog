import type {
  Currency, Direction, Outcome, Pair, PeriodType, PropFase, ResultUnit, Sessie,
  TradeEvaluation,
} from "./constants";

/** Mirrors the `trades` table in supabase/schema.sql 1:1. */
export interface Trade {
  id: string;
  user_id: string;

  datum_open: string; // ISO date (yyyy-mm-dd)
  /**
   * Real open time next to datum_open (Fase S2, 0051) — wall-clock "HH:MM:SS"
   * in the user's own profiles.timezone, exactly as typed (the DB stores a naive
   * `time`, the form writes "HH:MM"). null = time unknown (pre-0051 trades,
   * quick-log, imports): the trade then sits out the time-based session/hour
   * breakdowns. When set, the DB trigger derives `sessie` from this instead of
   * the legacy cc slot (compute_sessie_at, 0051).
   */
  tijd_open: string | null;
  datum_sluiting: string | null;
  duur_dagen: number | null; // DB-generated, read-only

  pair: Pair;
  /**
   * Free instrument symbol — the universal instrument field for any asset class
   * (Scope C, cyclus 7). Forex journals mirror this to `pair`; non-forex journals
   * write their own ticker/coin here and leave `pair` on a default. null on trades
   * logged before it existed (read it as `instrument ?? pair` for display).
   */
  instrument: string | null;
  /** Long/Short — universal core field (Scope C, cyclus 5). null on trades logged before it existed. */
  direction: Direction | null;
  /**
   * A still-running trade logged before it's closed (migration 0043). While true,
   * `outcome`/`resultaat_pct` are null (no realized result yet) and the trade is
   * excluded from every realized number via closedTrades() in stats/core.ts —
   * the same exclusion contract as a "Missed trade". Closing it (edit form) flips
   * this to false and fills in the result.
   */
  is_open: boolean;
  /** null only while `is_open` — a closed trade always carries its Win/Loss/BE (DB check trades_open_result_chk). */
  outcome: Outcome | null;
  /** null only while `is_open` — a closed trade always carries its realized % (DB check trades_open_result_chk). */
  resultaat_pct: number | null;
  /** Planned risk % this trade was taken with. null = the default 1% (DEFAULT_RISK_PCT). Denominator for R-multiples — read it via riskPct() in stats/core.ts, never divide directly. */
  risk_pct: number | null;
  trade_evaluation: TradeEvaluation | null;

  /**
   * Maximum Adverse Excursion (Fase N3, 0049) — the worst unrealized drawdown the
   * trade saw before it closed, as a POSITIVE magnitude in the same unit as
   * resultaat_pct (% of account). Optional, hand-entered; null = not tracked, the
   * trade simply doesn't take part in the exit stats (src/lib/stats/exit.ts).
   * Always null while is_open (DB check trades_open_no_excursion_chk).
   */
  mae_pct: number | null;
  /** Maximum Favorable Excursion — best unrealized profit during the trade, positive magnitude, % of account. Same optionality/open-trade rules as mae_pct. */
  mfe_pct: number | null;
  /** Reward:risk multiple planned at entry (e.g. 3 = a 3R target). Optional; unlike MAE/MFE it may be set while the trade is still open (it's the plan, not the outcome). */
  planned_rr: number | null;

  /** DB-maintained (tz-aware trigger, derived from tijd_open, else custom.cc — compute_sessie_at/0051, 0059), read-only. null when the trade carries neither a real open time nor a cc slot. */
  sessie: Sessie | null;

  w_screenshot: string | null;
  d_screenshot: string | null;
  h4_screenshot: string | null;
  h2_screenshot: string | null;

  notes: string | null;

  weekly_review_id: string | null;

  /** Chart-prijzen (TV-extensie F2c, 0058): entry/SL/TP zoals ingetekend in TV's position-tool. Alles null op handmatige/bestaande trades; set-regel + richting-consistentie zitten hard in de DB (trades_prices_*_chk). */
  entry_price: number | null;
  stop_price: number | null;
  target_price: number | null;
  /** F5-haak (close-from-chart) — nu altijd null. */
  exit_price: number | null;

  /** null = live Journal trade. Set = belongs to exactly that backtest project, isolated from Journal and every other project. */
  backtest_project_id: string | null;

  /** Broker-import dedup reference "{broker}:{ticket}", null for hand-entered trades. Set only by the CSV importer — never editable in the form. See src/lib/import. */
  import_ref: string | null;

  /** Methodology (journal) this trade was logged under (Scope C). null on legacy/unassigned trades. Set by the form to the active methodology on new trades (cyclus 3). */
  methodology_id: string | null;
  /** Flexible per-trade custom-field bag (Scope C, was `kenmerken` — renamed in 0022) that replaces the fixed fase*_ columns — keyed by MethodologyField.field_key. Written by the dynamic form section (cyclus 3). */
  custom: Record<string, boolean | string | number>;

  created_at: string;
  updated_at: string;
}

/**
 * Payload for insert/update — excludes server-managed/generated fields and
 * import-only columns. `methodology_id` + `custom` ARE included: the form writes
 * them (Scope C, cyclus 3) — the active journal and its per-trade custom-field bag.
 */
export type TradeInput = Omit<
  Trade,
  | "id" | "user_id" | "duur_dagen" | "sessie" | "created_at" | "updated_at"
  | "weekly_review_id" | "import_ref"
>;

/**
 * The value bag for a journal's *custom* review sections (Fase N5, 0048), keyed
 * by section_key — mirrors trades.custom for trade fields. Built-in sections keep
 * their own columns (verhalen/technisch/…); only user-added sections land here. A
 * text section stores a string, a list section a string[]. Always an object (DB
 * default '{}'), never null.
 */
export type ReviewContentBag = Record<string, string | string[]>;

export interface WeeklyReview {
  id: string;
  user_id: string;
  /** Which journal this review belongs to (per-journal isolation, cyclus 3b). Injected by the hook on create. */
  methodology_id: string | null;
  week_nummer: number;
  jaar: number;
  titel: string | null;
  verhalen: string | null;
  technisch: string | null;
  mentaal_owner: string | null;
  mentaal_trader: string | null;
  acties: string[];
  takeaway: string | null;
  overall_comment: string | null;
  /** Values of this journal's custom review sections (Fase N5, 0048); {} for the built-in section set. */
  content: ReviewContentBag;
  created_at: string;
  updated_at: string;
}

export type WeeklyReviewInput = Omit<WeeklyReview, "id" | "user_id" | "methodology_id" | "created_at" | "updated_at">;

/** Monthly/quarterly/yearly review — mirrors the `periodic_reviews` table. PnL/win-rate are computed live from trades in the period's date range, not stored. */
export interface PeriodicReview {
  id: string;
  user_id: string;
  /** Which journal this review belongs to (per-journal isolation, cyclus 3b). Injected by the hook on create. */
  methodology_id: string | null;
  period_type: PeriodType;
  jaar: number;
  periode_nummer: number | null; // 1-12 for month, 1-4 for quarter, null for year
  titel: string | null;
  technisch: string | null;
  mentaal_owner: string | null;
  mentaal_trader: string | null;
  acties: string[];
  takeaway: string | null;
  overall_comment: string | null;
  periode_overzicht: string | null;
  /** Values of this journal's custom review sections (Fase N5, 0048); {} for the built-in section set. */
  content: ReviewContentBag;
  created_at: string;
  updated_at: string;
}

export type PeriodicReviewInput = Omit<PeriodicReview, "id" | "user_id" | "methodology_id" | "created_at" | "updated_at">;

/**
 * A short free-text note about one calendar day (the dagboek). Deliberately
 * GLOBAL per user — no methodology_id — so the same daily notes stay visible
 * across every journal switch (0055), unlike trades/reviews which are per-journal.
 * One row per (user_id, entry_date); the app upserts on that pair.
 */
export interface DailyJournalEntry {
  id: string;
  user_id: string;
  /** The calendar day this note is about, ISO `YYYY-MM-DD` (a Postgres `date`). */
  entry_date: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One calendar day of habit completions (owner/beta habit tracker, migration
 * 0054). Life-level, so per-user only — not journal-scoped.
 * `values` is a `{ [habitKey]: true }` bag of the habits completed that day,
 * keyed by `Habit.key`. Mirrors the `habit_days` table 1:1.
 */
export interface HabitDay {
  id: string;
  user_id: string;
  /** The calendar day (local yyyy-mm-dd) these habits belong to. */
  day: string;
  /** Completed habits that day: `{ [habitKey]: true }`. */
  values: Record<string, boolean>;
  created_at: string;
}

/** A daily checkbox habit, or a weekly-target habit (ticked on the days it happens). */
export type HabitTier = "daily" | "weekly";

/**
 * One user-defined habit (migration 0056) — the configurable replacement for the
 * old hardcoded 90-Day-Run list. Each user builds their own on the Habits page.
 * `key` is a stable identifier stored in every `habit_days.values` bag, so
 * renaming a habit never orphans its tick history. `is_floor` marks a habit as a
 * daily non-negotiable — a day's "floor" is met when ALL floor habits are done.
 * Mirrors the `habits` table 1:1.
 */
export interface Habit {
  id: string;
  user_id: string;
  key: string;
  label: string;
  tier: HabitTier;
  /** Weekly target count; null for daily habits. */
  target: number | null;
  is_floor: boolean;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** Payload for creating/updating a habit — server-managed columns excluded. */
export type HabitInput = {
  label: string;
  tier: HabitTier;
  target: number | null;
  is_floor: boolean;
};

/** Whether a review section holds a single block of prose or a growable list of rows (Fase N5). */
export type ReviewSectionInputType = "text" | "list";

/** Which review type a section configures. Weekly and periodic reviews keep separate section sets per journal. */
export type ReviewKind = "weekly" | "periodic";

/**
 * One configurable review section of a journal (Fase N5, 0048) — the review-side
 * counterpart of MethodologyField. When a journal has no rows for a given kind it
 * falls back to the built-in default set (src/lib/reviewSections.ts); as soon as
 * it has any, that ordered list fully replaces the defaults. A built-in section
 * key (verhalen/technisch/…) reads/writes its own review column; any other key
 * stores its value in the review's `content` bag.
 */
export interface ReviewSectionRow {
  id: string;
  methodology_id: string;
  review_kind: ReviewKind;
  /** Stable key: a built-in column name, or a slug into the review.content bag. */
  section_key: string;
  label: string;
  /** Render-time translation key for the built-in defaults (0047-style); null for user-custom sections. */
  label_key: string | null;
  input_type: ReviewSectionInputType;
  sort_order: number;
}

/**
 * Display-only slice of a review-section row, shipped by get_shared_review (0048)
 * so a shared review renders its journal's custom sections with the right labels
 * and order. Mirrors SharedMethodologyField.
 */
export interface SharedReviewSection {
  section_key: string;
  label: string;
  label_key: string | null;
  input_type: ReviewSectionInputType;
  sort_order: number;
}

export interface PropAccount {
  id: string;
  user_id: string;
  /** Which journal this account belongs to (per-journal isolation, cyclus 3b). Injected by the hook on create. */
  methodology_id: string | null;
  naam: string;
  account_size: number;
  fase: PropFase;
  actief: boolean;
  current_pnl_pct: number | null;
  // Prop-firm rules (% of account size, null = not configured). See stats/propFirm.ts.
  profit_target_pct: number | null;
  max_drawdown_pct: number | null;
  daily_loss_limit_pct: number | null;
  created_at: string;
  updated_at: string;
}

export type PropAccountInput = Omit<PropAccount, "id" | "user_id" | "methodology_id" | "created_at" | "updated_at">;

export interface Payout {
  id: string;
  account_id: string;
  bedrag: number;
  datum: string;
  notes: string | null;
  created_at: string;
}

export type PayoutInput = Omit<Payout, "id" | "created_at">;

export interface BacktestProject {
  id: string;
  user_id: string;
  naam: string;
  beschrijving: string | null;
  created_at: string;
  updated_at: string;
}

export type BacktestProjectInput = Omit<BacktestProject, "id" | "user_id" | "created_at" | "updated_at">;

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  plan: string;
  role: "user" | "admin";
  /** IANA timezone the trade open time is read in — drives the tz-aware `trades.sessie` mapping (compute_sessie_at in the DB). Defaults to 'Europe/Brussels'. */
  timezone: string;
  /** Active methodology / journal (Scope C). Defaults to the built-in Weekly Phase Method template; drives which custom fields the UI shows. See useMethodology. */
  methodology_id: string | null;
  /**
   * Soft-launch gate (0033): shows the multi-journal UI (journal-switcher, preset-
   * picker, veld-editor, Richting-veld/filter) only to flagged users. Everyone else
   * sees just the bug fixes until the public launch flips this on for all. Set via
   * SQL only — no UI toggle, deliberately.
   */
  beta_features: boolean;
  /**
   * Weergave-eenheid voor resultaten (Fase J / 0037): '%', R of geld. Display-only —
   * stats en opslag blijven in % (resultaat_pct), conversie zit in de weergavelaag.
   */
  result_unit: ResultUnit;
  /**
   * First-run onboarding marker (Fase N4 / 0041). null = the onboarding wizard
   * hasn't been completed yet → it shows on next login (beta-gated); stamped
   * ISO-now the moment the user finishes or skips it.
   */
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A trading methodology / journal (Scope C) — a user-owned definition of fields
 * (+ its asset class and instrument config), or the built-in system template
 * (user_id null, is_system). Replaces the fixed FASES / FASE_KENMERKEN constants
 * as the source of truth for the UI. See migrations 0020 + 0022.
 */
export interface Methodology {
  id: string;
  user_id: string | null; // null = built-in system template (read-only for everyone)
  naam: string;
  is_system: boolean;
  /** forex | futures | stock | crypto | custom — the journal's asset class (free text). null on legacy rows. See 0022. */
  asset_class: string | null;
  /** Instrument universe + sizing tools per asset. Populated in cyclus 7; null until then. */
  instrument_config: Record<string, unknown> | null;
  /**
   * Per-journal opt-in for the advanced-analysis layer (0050): the planned R:R +
   * MAE/MFE fields in the trade form, the exit-analysis view, and the SQN KPI card.
   * Default false — the trader activates it per journal in the builder / editor.
   */
  track_exit: boolean;
  /**
   * Per-journal names for the 4 screenshot slots (0060): array of 4 strings,
   * index 0..3 = w/d/h4/h2. null = defaults (Weekly/Daily/4H/Extra, or Screenshot 1-4);
   * an empty string at a position = default for that slot.
   */
  screenshot_labels: string[] | null;
  /**
   * Per-journal TV-timeframes for those same 4 slots (0061): array of 4
   * TV-resolution strings ("W","D","240","15",...), index 0..3 = w/d/h4/h2.
   * null = defaults (W/D/240/120); an empty string at a position = default for
   * that slot. Values validated against the whitelist in screenshotSlots.ts.
   */
  screenshot_timeframes: string[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * The methodology-derived facts BacktestingAnalysisView needs to render the right
 * breakdowns (which are journal-type-specific): the field list (for custom-field
 * breakdowns), and whether the journal is a forex journal. Normally read from the
 * live `useMethodology()` context, but the admin read-only view must pass the
 * *viewed* user's journal instead of the viewer's — see getMethodologyViewForUser
 * + the `methodologyOverride` prop (H2).
 */
export interface MethodologyView {
  fields: MethodologyField[];
  isForexJournal: boolean;
  /** Whether the viewed journal has the advanced-analysis layer on (0050) — gates the exit-analysis section. */
  trackExit: boolean;
}

/** One custom field of a methodology/journal (replaces the fixed FASE_KENMERKEN config). See 0022. */
export interface MethodologyField {
  id: string;
  methodology_id: string;
  /** Stable key used inside the trades.custom jsonb bag. */
  field_key: string;
  label: string;
  /**
   * Catalogue block key (fieldBlocks.ts) this field was created from — drives
   * render-time label translation via t(`blocks.items.${label_key}.label`), so the
   * label follows the UI language instead of freezing in its creation language
   * (Fase G-rest A3, 0047). Null for custom fields; a DB trigger clears it when
   * the free-text label is renamed, so the user's own wording always wins.
   */
  label_key: string | null;
  field_type: "boolean" | "enum" | "text" | "number" | "date";
  /** Ordered allowed values for an enum field; null for the other types. */
  options: string[] | null;
  /** Derived field (e.g. Fase 3 "Beide?") — shown read-only, never stored in the bag. */
  is_computed: boolean;
  /** Form section header this field groups under; null = ungrouped. See 0022. */
  group_label: string | null;
  /** Catalogue group key ('setup' | 'markt' | 'mindset') for render-time translation of the group header — same mechanics and trigger as label_key (0047). */
  group_key: string | null;
  /** Mandatory on input. See 0022. */
  required: boolean;
  /** Conditional visibility: show this field only when the referenced field's value is in show_when_values. null = always shown. See 0022. */
  show_when_field_id: string | null;
  show_when_values: string[] | null;
  sort_order: number;
}

/**
 * One share-link (Fase M / 0040, review-scope 0042): a capability token that
 * shows this user's journal — or one review — read-only to anyone holding the
 * URL, no account needed. Owner-managed via RLS; the anonymous viewer only ever
 * reads through the get_shared_journal / get_shared_review RPCs.
 */
export interface ShareLink {
  id: string;
  user_id: string;
  /** Which journal a 'journal' link exposes. null = the legacy/unscoped journal (trades.methodology_id is null) — and always null on 'review' links, whose journal follows from the review row itself. */
  methodology_id: string | null;
  scope: "journal" | "review";
  /** Exactly one of these is set on a 'review' link (DB CHECK); both null on 'journal' links. */
  weekly_review_id: string | null;
  periodic_review_id: string | null;
  /** The URL capability — 64 random hex chars, generated by the DB default. */
  token: string;
  /** null = never expires. */
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

/**
 * Display-only slice of a methodology_fields row, shipped by the share RPCs
 * (0042) so the shared trade-detail modal can label trades.custom values.
 * Deliberately without required/show_when — the share view never renders a form.
 */
export interface SharedMethodologyField {
  field_key: string;
  label: string;
  /** Render-time translation key (0047) — undefined at runtime until the owner's DB ran that migration; the fieldLabel() fallback covers both. */
  label_key: string | null;
  field_type: MethodologyField["field_type"];
  options: string[] | null;
  group_label: string | null;
  group_key: string | null;
  is_computed: boolean;
  sort_order: number;
}

/**
 * What get_shared_journal(token) returns for a valid link. Trades come from an
 * explicit allow-list in the RPC (no `user_id`/`import_ref`; storage-path
 * screenshots blanked to null server-side) — cast to Trade for the shared
 * read-only components, which never read the omitted fields.
 */
export interface SharedJournal {
  /** Journal name; null for the legacy/unscoped journal. */
  journal_name: string | null;
  display_name: string | null;
  /** Owner's display unit — the share view honours % and R; currency falls back to % (no saldo without auth). */
  result_unit: ResultUnit;
  /** Field definitions of the shared journal (custom-veld labels); [] for the legacy/unscoped journal. */
  fields: SharedMethodologyField[];
  trades: Trade[];
}

/** Review-content slice the share RPC returns — the owner-only columns (user_id, methodology_id, timestamps) stay behind. */
export type SharedWeeklyReview = Omit<WeeklyReview, "user_id" | "methodology_id" | "created_at" | "updated_at">;
export type SharedPeriodicReview = Omit<PeriodicReview, "user_id" | "methodology_id" | "created_at" | "updated_at">;

/**
 * What get_shared_review(token) returns for a valid 'review' link (0042).
 * Unlike SharedJournal the trades DO include missed rows — the review view
 * shows them as their own badged group, exactly like the owner's own review
 * detail (client splits with takenTrades()/missedTrades()). No `fields`: the
 * review share renders list rows only, no trade-detail modal.
 */
export type SharedReview = {
  journal_name: string | null;
  display_name: string | null;
  result_unit: ResultUnit;
  /**
   * The shared journal's custom review sections (Fase N5, 0048); [] when the
   * journal uses the built-in default set — the share view then resolves the
   * defaults client-side exactly like the owner's own view.
   */
  sections: SharedReviewSection[];
  trades: Trade[];
} & (
  | { kind: "weekly"; review: SharedWeeklyReview }
  | { kind: "periodic"; review: SharedPeriodicReview }
);

export interface CustomOption {
  id: string;
  user_id: string;
  field: string;
  value: string;
  created_at: string;
}

export type CustomOptionInput = Pick<CustomOption, "field" | "value">;

export { type Currency };
