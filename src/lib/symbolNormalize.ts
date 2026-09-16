// TV-symbool → Beyen-instrument/pair (TV-extensie F2b, plan M5). Pure module:
// geen React/supabase/window, zodat de extensie (extension/) 'm rechtstreeks
// kan importeren (plan §2.5 — één implementatie, geen kopie).
import { PAIRS, type Pair } from "./constants";
import { normalizeInstrument } from "./instruments";

export interface ParsedTvSymbol {
  /** Prefix vóór de dubbele punt ("OANDA", "BINANCE", "FX", …); null zonder prefix. */
  exchange: string | null;
  ticker: string;
}

/** "OANDA:NZDCHF" → { exchange: "OANDA", ticker: "NZDCHF" }. Null bij lege/onbruikbare input. */
export function parseTvSymbol(raw: string): ParsedTvSymbol | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  const colon = trimmed.indexOf(":");
  if (colon === -1) return { exchange: null, ticker: trimmed };
  const exchange = trimmed.slice(0, colon).trim();
  const ticker = trimmed.slice(colon + 1).trim();
  if (!ticker) return null;
  return { exchange: exchange || null, ticker };
}

export type SymbolKind = "forex-pair" | "futures-continuous" | "other";

export interface NormalizedSymbol {
  /** Match in de vaste PAIRS-lijst (incl. XAUUSD/XAGUSD), anders null. */
  pair: Pair | null;
  /** Vrij instrument-symbool, genormaliseerd via normalizeInstrument. Altijd gezet. */
  instrument: string;
  kind: SymbolKind;
  exchange: string | null;
}

const PAIR_SET: ReadonlySet<string> = new Set(PAIRS);

/** Continuous-futures-notatie: "ES1!", "NQ2!" → basis "ES"/"NQ". */
const CONTINUOUS_RE = /^([A-Z0-9]+?)\d+!$/;

/**
 * Broker-/CFD-suffixen ("EURUSD.PRO", "EURUSD_SB", "EURUSDm") worden alléén
 * gestript wanneer het restant een bekende pair is — agressiever strippen zou
 * onbekende tickers stilletjes verminken (degradatie-regel: liever "other" dan
 * een verkeerde match).
 */
function pairFromTicker(ticker: string): Pair | null {
  if (PAIR_SET.has(ticker)) return ticker as Pair;
  const stripped = ticker.replace(/[._-][A-Z0-9]{1,4}$/, "");
  if (stripped !== ticker && PAIR_SET.has(stripped)) return stripped as Pair;
  const suffixTrim = ticker.replace(/(M|C|ECN|PRO)$/, "");
  if (suffixTrim !== ticker && PAIR_SET.has(suffixTrim)) return suffixTrim as Pair;
  return null;
}

/**
 * Eén normalisatiepad voor alles wat uit TV's `symbol()` komt:
 * - forex (elke prefix): match tegen PAIRS, met voorzichtige suffix-strip;
 * - futures continuous ("ES1!") → basis-symbool, kind "futures-continuous";
 * - al het andere (crypto, indices, aandelen) → genormaliseerd vrij instrument.
 * De journal-afhankelijke keuze (pair-veld vs. instrument-veld) hoort NIET hier
 * maar in buildTradePayload — dit is alleen de parser.
 */
export function normalizeTvSymbol(raw: string): NormalizedSymbol | null {
  const parsed = parseTvSymbol(raw);
  if (!parsed) return null;

  const continuous = CONTINUOUS_RE.exec(parsed.ticker);
  if (continuous) {
    return {
      pair: null,
      instrument: normalizeInstrument(continuous[1]),
      kind: "futures-continuous",
      exchange: parsed.exchange,
    };
  }

  const pair = pairFromTicker(parsed.ticker);
  if (pair) {
    return { pair, instrument: pair, kind: "forex-pair", exchange: parsed.exchange };
  }

  const instrument = normalizeInstrument(parsed.ticker);
  if (!instrument) return null;
  return { pair: null, instrument, kind: "other", exchange: parsed.exchange };
}
