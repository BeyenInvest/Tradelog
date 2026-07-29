import { currenciesOfPair, type ForexPair } from "./constants";

export type AccountCurrency = "USD" | "EUR";

/** Standard lot = 100,000 units of the pair's base currency — the one universal constant across all forex brokers. */
export const UNITS_PER_STANDARD_LOT = 100_000;

export type ConversionCase = "direct" | "inverse" | "cross";

/**
 * "direct": account currency is the pair's quote currency — no price/rate
 *   needed at all, the pip value is already in the account currency.
 * "inverse": account currency is the pair's base currency — needs the
 *   pair's current price to convert the quote-currency pip value.
 * "cross": account currency is neither — needs a separate quote→account rate.
 */
export function getConversionCase(pair: ForexPair, accountCurrency: AccountCurrency): ConversionCase {
  const [base, quote] = currenciesOfPair(pair);
  if (quote === accountCurrency) return "direct";
  if (base === accountCurrency) return "inverse";
  return "cross";
}

export function requiresCurrentPrice(pair: ForexPair, accountCurrency: AccountCurrency): boolean {
  return getConversionCase(pair, accountCurrency) === "inverse";
}

export function requiresCrossRate(pair: ForexPair, accountCurrency: AccountCurrency): boolean {
  return getConversionCase(pair, accountCurrency) === "cross";
}

export interface LotSizeInput {
  accountCurrency: AccountCurrency;
  accountBalance: number;
  riskPercent: number;
  stopLossPips: number;
  pair: ForexPair;
  /** Current market price of the pair — only required when requiresCurrentPrice() is true. User-supplied, never fetched, so it's never stale. */
  currentPrice?: number;
  /**
   * "1 unit of quote currency = ? units of account currency." Only required
   * when requiresCrossRate() is true.
   */
  quoteToAccountRate?: number;
}

export interface LotSizeResult {
  lots: number;
  units: number;
  riskAmount: number;
  /** Pip value for one standard lot, already converted into the account currency. */
  pipValuePerLot: number;
  pipSize: number;
  conversionCase: ConversionCase;
}

export interface LotSizeFieldError {
  field: "accountBalance" | "riskPercent" | "stopLossPips" | "currentPrice" | "quoteToAccountRate";
  message: string;
}

export type LotSizeOutcome = { ok: true; result: LotSizeResult } | { ok: false; errors: LotSizeFieldError[] };

/** JPY pairs quote to 2 decimals (1 pip = 0.01); every other forex pair quotes to 4 decimals (1 pip = 0.0001). */
export function pipSizeOf(pair: ForexPair): number {
  const [, quote] = currenciesOfPair(pair);
  return quote === "JPY" ? 0.01 : 0.0001;
}

/**
 * Position sizing from risk, not from a guessed exchange rate: the only
 * prices this function ever needs (currentPrice, quoteToAccountRate) are
 * supplied by the caller, never fetched — and only ever asked for when the
 * math actually requires them (see getConversionCase) — so a correct output
 * only ever depends on the trader typing in what their own platform already
 * shows them, nothing more.
 */
export function calculateLotSize(input: LotSizeInput): LotSizeOutcome {
  const errors: LotSizeFieldError[] = [];

  if (!(input.accountBalance > 0)) errors.push({ field: "accountBalance", message: "Moet groter dan 0 zijn" });
  if (!(input.riskPercent > 0)) errors.push({ field: "riskPercent", message: "Moet groter dan 0 zijn" });
  if (!(input.stopLossPips > 0)) errors.push({ field: "stopLossPips", message: "Moet groter dan 0 zijn" });

  const conversionCase = getConversionCase(input.pair, input.accountCurrency);

  if (conversionCase === "inverse" && !(input.currentPrice! > 0)) {
    errors.push({ field: "currentPrice", message: "Verplicht voor deze pair/accountvaluta-combinatie" });
  }
  if (conversionCase === "cross" && !(input.quoteToAccountRate! > 0)) {
    errors.push({ field: "quoteToAccountRate", message: "Verplicht voor deze pair/accountvaluta-combinatie" });
  }

  if (errors.length > 0) return { ok: false, errors };

  const pipSize = pipSizeOf(input.pair);
  const pipValuePerLotInQuote = pipSize * UNITS_PER_STANDARD_LOT;

  const pipValuePerLot =
    conversionCase === "direct"
      ? pipValuePerLotInQuote
      : conversionCase === "inverse"
        ? pipValuePerLotInQuote / input.currentPrice!
        : pipValuePerLotInQuote * input.quoteToAccountRate!;

  const riskAmount = input.accountBalance * (input.riskPercent / 100);
  const lots = riskAmount / (input.stopLossPips * pipValuePerLot);
  const units = lots * UNITS_PER_STANDARD_LOT;

  return {
    ok: true,
    result: {
      lots: round(lots, 2),
      units: round(units, 0),
      riskAmount: round(riskAmount, 2),
      pipValuePerLot: round(pipValuePerLot, 4),
      pipSize,
      conversionCase,
    },
  };
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
