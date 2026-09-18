/** Public support/contact address. Single source of truth — reused wherever we
 *  surface a "contact us" link (Settings, and later Terms/Privacy). */
export const SUPPORT_EMAIL = "info@beyen.app";

export const OUTCOMES = ["Win", "Loss", "BE"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Trade direction — universal core field (Scope C, cyclus 5). null on legacy trades logged before it existed. */
export const DIRECTIONS = ["Long", "Short"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * Fixed id of the seeded Weekly Phase Method system template (0020). Used to pin
 * the no-active-journal fallback in useMethodology/useMethodologyEditor — since
 * the preset catalogue (0027/0028) there are ~11 is_system rows, so "any system
 * methodology" would be a non-deterministic pick. Since the fase-retirement (0059)
 * the WPM template is a fully config-driven journal like any other — no hardcoded
 * columns — so this id is now only the fallback pin, nothing special-cases it.
 */
export const WPM_TEMPLATE_METHODOLOGY_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Weergave-eenheid voor resultaten (Fase J / 0037) — puur een display-voorkeur
 * per gebruiker (profiles.result_unit). Alle opslag en alle stats blijven in %
 * (resultaat_pct); conversie naar R of geld gebeurt uitsluitend in de weergavelaag.
 */
export const RESULT_UNITS = ["percent", "R", "currency"] as const;
export type ResultUnit = (typeof RESULT_UNITS)[number];

/**
 * Self-assessment of how the trade was executed — separate from outcome
 * (Win/Loss/BE, the P&L result). "Missed trade" is special: a setup you saw
 * but didn't take, still logged with a hypothetical outcome/resultaat_pct,
 * excluded from the live Journal's stats/calendar by default (see the "toon
 * missed trades" toggle) and never selectable within a backtest project.
 */
export const TRADE_EVALUATIONS = ["Good trade", "Emotional error", "Technical error", "Missed trade"] as const;
export type TradeEvaluation = (typeof TRADE_EVALUATIONS)[number];

/**
 * The three execution grades of a *taken* trade — every evaluation except the
 * hypothetical "Missed trade". Derived from TRADE_EVALUATIONS so an enum change
 * flows through automatically instead of needing a parallel literal list.
 */
export type GradedEvaluation = Exclude<TradeEvaluation, "Missed trade">;
export const GRADED_EVALUATIONS = TRADE_EVALUATIONS.filter((e): e is GradedEvaluation => e !== "Missed trade");

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

export const SESSIES = ["Asia", "London", "Overlap", "New York"] as const;
export type Sessie = (typeof SESSIES)[number];

// Sessie is timezone-aware and computed in the DB, never derived client-side.
// The real open time (trades.tijd_open, 0051) is interpreted in the user's
// profiles.timezone and bucketed against the reference zone (compute_sessie_at).
// A trade without tijd_open has no sessie, so the session/hour breakdowns only
// cover trades that carry a real open time — breakdownDimensionsFor() encodes
// that client-side nuance.

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

/** month/quarter/year — "week" stays on its own dedicated table (weekly_reviews), unchanged. */
export const PERIOD_TYPES = ["month", "quarter", "year"] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

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
 * Above this absolute % result a single trade is almost always a fat-fingered
 * decimal (e.g. 250 instead of 2.5) — the trade form shows a soft, non-blocking
 * "did you mean...?" warning past it. Deliberately generous so a genuine big
 * win/loss doesn't nag; it never blocks saving (a real +30% must still go in).
 */
export const SANITY_RESULT_PCT = 20;

