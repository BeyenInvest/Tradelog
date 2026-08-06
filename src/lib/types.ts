import type {
  CC, Currency, Fase, Outcome, Pair, PeriodType, PropFase, Sessie,
  Structuur, TradeConcept, TradeEvaluation, WeeklyCriteria, WeeklyKenmerk,
} from "./constants";

/** Mirrors the `trades` table in supabase/schema.sql 1:1. */
export interface Trade {
  id: string;
  user_id: string;

  fase: Fase;
  datum_open: string; // ISO date (yyyy-mm-dd)
  datum_sluiting: string | null;
  duur_dagen: number | null; // DB-generated, read-only

  pair: Pair;
  outcome: Outcome;
  resultaat_pct: number;
  /** Planned risk % this trade was taken with. null = the default 1% (DEFAULT_RISK_PCT). Denominator for R-multiples — read it via riskPct() in stats/core.ts, never divide directly. */
  risk_pct: number | null;
  trade_evaluation: TradeEvaluation | null;

  weekly_criteria: WeeklyCriteria | null;
  weekly_kenmerk: WeeklyKenmerk | null;
  trade_concept: TradeConcept | null;
  /** ENTRIES (constants.ts) or one of this user's own custom_options rows for field='entry' — see useCustomOptions. */
  entry: string | null;

  cc: CC;
  sessie: Sessie; // DB-generated, read-only

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

  created_at: string;
  updated_at: string;
}

/** Payload for insert/update — excludes server-managed/generated fields. */
export type TradeInput = Omit<
  Trade,
  "id" | "user_id" | "duur_dagen" | "sessie" | "fase3_beide" | "created_at" | "updated_at" | "weekly_review_id"
>;

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_nummer: number;
  jaar: number;
  titel: string | null;
  technisch: string | null;
  mentaal_owner: string | null;
  mentaal_trader: string | null;
  acties: string[];
  takeaway: string | null;
  overall_comment: string | null;
  created_at: string;
  updated_at: string;
}

export type WeeklyReviewInput = Omit<WeeklyReview, "id" | "user_id" | "created_at" | "updated_at">;

/** Monthly/quarterly/yearly review — mirrors the `periodic_reviews` table. PnL/win-rate are computed live from trades in the period's date range, not stored. */
export interface PeriodicReview {
  id: string;
  user_id: string;
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

export type PeriodicReviewInput = Omit<PeriodicReview, "id" | "user_id" | "created_at" | "updated_at">;

export interface PropAccount {
  id: string;
  user_id: string;
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

export type PropAccountInput = Omit<PropAccount, "id" | "user_id" | "created_at" | "updated_at">;

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
  created_at: string;
  updated_at: string;
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
