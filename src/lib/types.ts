import type {
  CC, Currency, Direction, Outcome, Pair, PeriodType, PropFase, Sessie,
  Structuur, TradeEvaluation, WeeklyCriteria, WeeklyKenmerk,
} from "./constants";

/** Mirrors the `trades` table in supabase/schema.sql 1:1. */
export interface Trade {
  id: string;
  user_id: string;

  /**
   * Fase name. Since Scope C (migration 0020+) this is the name of a fase in the
   * trade's methodology, not the fixed FASES enum — free text, like `entry`.
   * For Weekly Phase Method users the values are still "Fase 1".."Fase 4".
   */
  fase: string;
  datum_open: string; // ISO date (yyyy-mm-dd)
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
  outcome: Outcome;
  resultaat_pct: number;
  /** Planned risk % this trade was taken with. null = the default 1% (DEFAULT_RISK_PCT). Denominator for R-multiples — read it via riskPct() in stats/core.ts, never divide directly. */
  risk_pct: number | null;
  trade_evaluation: TradeEvaluation | null;

  weekly_criteria: WeeklyCriteria | null;
  weekly_kenmerk: WeeklyKenmerk | null;
  /** TRADE_CONCEPTS (constants.ts) or one of this user's own custom_options rows for field='trade_concept' — see useCustomOptions. */
  trade_concept: string | null;
  /** ENTRIES (constants.ts) or one of this user's own custom_options rows for field='entry' — see useCustomOptions. */
  entry: string | null;

  cc: CC;
  sessie: Sessie; // DB-maintained (tz-aware trigger, see compute_sessie/0019), read-only

  nieuws: boolean;
  w_confirm: boolean | null;
  d_confirm: boolean | null;
  h4_confirm: boolean | null;
  w_screenshot: string | null;
  d_screenshot: string | null;
  h4_screenshot: string | null;
  h2_screenshot: string | null;
  extra_d_conf: boolean | null;

  notes: string | null;

  fase1_daily_respecteert_zone: boolean | null;
  fase1_spelers_verleden: boolean | null;

  fase2_daily_respecteert_zone: boolean | null;
  fase2_structuur: Structuur | null;

  fase3_zone_min_2_touches: boolean | null;
  fase3_engulfing_candle: boolean | null;
  fase3_beide: boolean | null; // DB-generated, read-only
  fase3_structuur: Structuur | null;

  fase4_weekly_bevestigingscandle: boolean | null;

  weekly_review_id: string | null;

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
  | "id" | "user_id" | "duur_dagen" | "sessie" | "fase3_beide" | "created_at" | "updated_at"
  | "weekly_review_id" | "import_ref"
>;

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
  created_at: string;
  updated_at: string;
}

export type PeriodicReviewInput = Omit<PeriodicReview, "id" | "user_id" | "methodology_id" | "created_at" | "updated_at">;

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
  hide_fase: boolean;
  /** IANA timezone the user reads candle-close (cc) times in — drives the tz-aware `trades.sessie` mapping (compute_sessie in the DB). Defaults to 'Europe/Brussels'. */
  timezone: string;
  /** Active methodology (Scope C). Defaults to the built-in Weekly Phase Method template; drives which fases/kenmerken the UI shows. See useMethodology. */
  methodology_id: string | null;
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
  created_at: string;
  updated_at: string;
}

/** One fase within a methodology (replaces the fixed FASES enum). */
export interface MethodologyFase {
  id: string;
  methodology_id: string;
  naam: string;
  sort_order: number;
}

/** One custom field of a methodology/journal (replaces the fixed FASE_KENMERKEN config). See 0022. */
export interface MethodologyField {
  id: string;
  methodology_id: string;
  /** Legacy/transitional FK to methodology_fases; null on the new flat model where fase is itself a field (see 0023). */
  fase_id: string | null;
  /** Stable key used inside the trades.custom jsonb bag. */
  field_key: string;
  label: string;
  field_type: "boolean" | "enum" | "text" | "number" | "date";
  /** Ordered allowed values for an enum field; null for the other types. */
  options: string[] | null;
  /** Derived field (e.g. Fase 3 "Beide?") — shown read-only, never stored in the bag. */
  is_computed: boolean;
  /** Form section header this field groups under; null = ungrouped. See 0022. */
  group_label: string | null;
  /** Mandatory on input. See 0022. */
  required: boolean;
  /** Conditional visibility: show this field only when the referenced field's value is in show_when_values. null = always shown. See 0022. */
  show_when_field_id: string | null;
  show_when_values: string[] | null;
  sort_order: number;
}

export interface CustomOption {
  id: string;
  user_id: string;
  field: string;
  value: string;
  created_at: string;
}

export type CustomOptionInput = Pick<CustomOption, "field" | "value">;

export { type Currency };
