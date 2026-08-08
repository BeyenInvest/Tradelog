export const FASES = ["Fase 1", "Fase 2", "Fase 3", "Fase 4"] as const;
export type Fase = (typeof FASES)[number];

export const OUTCOMES = ["Win", "Loss", "BE"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/**
 * Self-assessment of how the trade was executed — separate from outcome
 * (Win/Loss/BE, the P&L result). "Missed trade" is special: a setup you saw
 * but didn't take, still logged with a hypothetical outcome/resultaat_pct,
 * excluded from the live Journal's stats/calendar by default (see the "toon
 * missed trades" toggle) and never selectable within a backtest project.
 */
export const TRADE_EVALUATIONS = ["Good trade", "Emotional error", "Technical error", "Missed trade"] as const;
export type TradeEvaluation = (typeof TRADE_EVALUATIONS)[number];

export const PAIRS = [
  "AUDCAD", "AUDCHF", "AUDJPY", "AUDNZD", "AUDUSD",
  "CADCHF", "CADJPY", "CHFJPY",
  "EURAUD", "EURCAD", "EURCHF", "EURGBP", "EURJPY", "EURNZD", "EURUSD",
  "GBPAUD", "GBPCAD", "GBPCHF", "GBPJPY", "GBPNZD", "GBPUSD",
  "NZDCAD", "NZDCHF", "NZDJPY", "NZDUSD",
  "USDCAD", "USDCHF", "USDJPY",
  "XAGUSD", "XAUUSD",
] as const;
export type Pair = (typeof PAIRS)[number];

export const CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD", "XAG", "XAU"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function currenciesOfPair(pair: Pair): [Currency, Currency] {
  return [pair.slice(0, 3) as Currency, pair.slice(3, 6) as Currency];
}

/** PAIRS minus XAUUSD/XAGUSD — metals have broker-specific pip/contract conventions with no universal standard, so they're excluded from anything that assumes a standard 100,000-unit lot. */
export const FOREX_PAIRS = PAIRS.filter((p) => p !== "XAGUSD" && p !== "XAUUSD");
export type ForexPair = Exclude<Pair, "XAGUSD" | "XAUUSD">;

export const WEEKLY_CRITERIA = ["Pattern", "High/Low", "IC", "Region"] as const;
export type WeeklyCriteria = (typeof WEEKLY_CRITERIA)[number];

export const WEEKLY_KENMERKEN = ["Trending market", "Corrective market", "Ranging market"] as const;
export type WeeklyKenmerk = (typeof WEEKLY_KENMERKEN)[number];

export const TRADE_CONCEPTS = [
  "Reversal", "Continuation", "Daily retrace", "Pattern in Pattern",
  "Push IC Push", "Weekly-4H", "Reclaim", "Small daily pattern",
] as const;
export type TradeConcept = (typeof TRADE_CONCEPTS)[number];

export const ENTRIES = [
  "Decel", "Reversal", "Continuation met ruimte", "Continuation zonder ruimte",
  "2H Entry", "Reclaim", "100 Fib", "Instant limiet",
] as const;
export type Entry = (typeof ENTRIES)[number];

export const CCS = ["03", "07", "11", "15", "19", "23"] as const;
export type CC = (typeof CCS)[number];

export const SESSIES = ["Asia", "London", "Overlap", "New York"] as const;
export type Sessie = (typeof SESSIES)[number];

// The cc -> sessie mapping is no longer a static table: it's timezone-aware and
// computed in the DB (compute_sessie(), see migration 0019). A candle-close slot
// is interpreted in the user's profiles.timezone and bucketed against the
// reference zone, so `trades.sessie` is read straight from the DB, never derived
// client-side.

export const STRUCTUREN = ["Inner", "Outer"] as const;
export type Structuur = (typeof STRUCTUREN)[number];

/**
 * Account "type" (DB column `fase`, prop_fase_enum). Phase 1/2/Funded are the
 * prop-firm challenge stages (kept as English jargon, shown literally everywhere
 * like OUTCOMES/FASES); "Private" is a personal (own-capital) account. The UI
 * labels this field "Type", not "Fase" — see AccountForm. Only "Private" gets a
 * translated display label (via propAccountTypeLabel); the jargon values stay literal.
 */
export const PROP_FASES = ["Phase 1", "Phase 2", "Funded", "Private"] as const;
export type PropFase = (typeof PROP_FASES)[number];

/** Display label for an account type value — only "Private" is translated (→ "Privé"/"Private"); prop-firm jargon stays literal. */
export function propAccountTypeLabel(value: string, t: (key: string) => string): string {
  return value === "Private" ? t("accounts.typePrivate") : value;
}

export const WEEKDAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
export type Quarter = (typeof QUARTERS)[number];

export const MONTH_NAMES = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
] as const;

/** month/quarter/year — "week" stays on its own dedicated table (weekly_reviews), unchanged. */
export const PERIOD_TYPES = ["month", "quarter", "year"] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  month: "Monthly",
  quarter: "Quarterly",
  year: "Yearly",
};

/** Minimum trades in a breakdown bucket before it's considered statistically meaningful (rekenregel 6). */
export const MIN_SAMPLE_SIZE = 15;

/**
 * Default planned risk % assumed for a trade with no explicit `risk_pct` (i.e. every
 * legacy trade, and anyone on the flat-1% workflow). It's the denominator for
 * R-multiples (R = resultaat_pct / risk_pct), so at this default R ≡ resultaat_pct —
 * the whole point of keeping R non-intrusive. Routed through riskPct() in stats/core.ts;
 * never divide by risk_pct directly.
 */
export const DEFAULT_RISK_PCT = 1;

/**
 * Fase-specifieke kenmerken (spec tabel 3.2), config-driven zodat de Backtesting
 * pagina elke fase-kenmerk-breakdown via één .map() rendert i.p.v. losse blokken.
 */
export interface FaseKenmerkConfig {
  fase: Fase;
  field: string;
  label: string;
  values: "boolean" | readonly string[];
  /** true for computed/read-only fields (e.g. fase3_beide) — not shown in the trade form. */
  computed?: boolean;
}

export const FASE_KENMERKEN: FaseKenmerkConfig[] = [
  { fase: "Fase 1", field: "fase1_daily_respecteert_zone", label: "Daily respecteert zone?", values: "boolean" },
  { fase: "Fase 1", field: "fase1_spelers_verleden", label: "Al spelers in verleden (W)?", values: "boolean" },
  { fase: "Fase 2", field: "fase2_daily_respecteert_zone", label: "Daily respecteert zone?", values: "boolean" },
  { fase: "Fase 2", field: "fase2_structuur", label: "Structuur", values: STRUCTUREN },
  { fase: "Fase 3", field: "fase3_zone_min_2_touches", label: "Zone met min. 2 vorige touches?", values: "boolean" },
  { fase: "Fase 3", field: "fase3_engulfing_candle", label: "Engulfing candle?", values: "boolean" },
  { fase: "Fase 3", field: "fase3_beide", label: "Beide?", values: "boolean", computed: true },
  { fase: "Fase 3", field: "fase3_structuur", label: "Structuur", values: STRUCTUREN },
  { fase: "Fase 4", field: "fase4_weekly_bevestigingscandle", label: "Weekly bevestigingscandle?", values: "boolean" },
];
