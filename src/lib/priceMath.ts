// Prijsrekenwerk voor de TV-extensie (F2b, plan C7/C8): position-tool-ticks →
// prijzen, R:R, pips, richting-consistentie. Pure module (geen React/supabase/
// window) — rechtstreeks importeerbaar vanuit extension/ (plan §2.5).
//
// Bron van de invoer (S0-spike, docs/spike-tv-extensie.md): TV's position-tool
// levert entry als prijs (points[0].price) en SL/TP als `stopLevel`/`profitLevel`
// in TICKS t.o.v. entry; de tick-size komt uit priceFormatter() als
// `_minMove / _priceScale` (bijv. 1/1000 = 0.001 voor JPY-paren).
import { type Direction } from "./constants";
import { round2 } from "./stats/core";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Tick-size uit TV's priceFormatter-velden; null bij onbruikbare invoer. */
export function tickSize(minMove: number, priceScale: number): number | null {
  if (!isFiniteNumber(minMove) || !isFiniteNumber(priceScale)) return null;
  if (minMove <= 0 || priceScale <= 0) return null;
  return minMove / priceScale;
}

/**
 * Fallback wanneer de formatter-props (underscore-interne velden — kunnen bij
 * een TV-release verdwijnen) onleesbaar zijn: tel decimalen in een geformatteerde
 * prijs ("1.235" → 0.001). Werkt niet voor fracties zoals 0.25 — de caller hoort
 * dat als degradatie te melden, niet stil te gokken.
 */
export function tickSizeFromFormatted(formatted: string): number | null {
  const m = /^\d+(?:\.(\d+))?$/.exec(formatted.trim());
  if (!m) return null;
  const decimals = m[1]?.length ?? 0;
  return 10 ** -decimals;
}

export interface PositionToolLevels {
  /** Entry-prijs (points[0].price van de shape). */
  entry: number;
  /** properties.stopLevel — afstand entry→SL in ticks (altijd positief in TV). */
  stopLevelTicks: number;
  /** properties.profitLevel — afstand entry→TP in ticks (altijd positief in TV). */
  profitLevelTicks: number;
}

export interface PositionPrices {
  entry: number;
  stop: number;
  target: number;
}

/**
 * Ticks → absolute prijzen. Long: SL onder entry, TP erboven; Short gespiegeld.
 * De shape-naam ("long_position"/"short_position") bepaalt de richting — de
 * ticks zelf zijn richtingloos.
 */
export function positionPrices(
  direction: Direction,
  levels: PositionToolLevels,
  tick: number
): PositionPrices | null {
  if (!isFiniteNumber(levels.entry) || !isFiniteNumber(tick) || tick <= 0) return null;
  if (!isFiniteNumber(levels.stopLevelTicks) || !isFiniteNumber(levels.profitLevelTicks)) return null;
  if (levels.stopLevelTicks <= 0 || levels.profitLevelTicks <= 0) return null;
  const sign = direction === "Long" ? 1 : -1;
  const stop = levels.entry - sign * levels.stopLevelTicks * tick;
  const target = levels.entry + sign * levels.profitLevelTicks * tick;
  return { entry: levels.entry, stop, target };
}

/** Richting die uit de prijzen volgt: SL onder entry = Long. Null bij gelijke prijzen. */
export function directionFromPrices(entry: number, stop: number): Direction | null {
  if (!isFiniteNumber(entry) || !isFiniteNumber(stop) || entry === stop) return null;
  return stop < entry ? "Long" : "Short";
}

/**
 * Geplande R:R = |target − entry| / |entry − stop|, afgerond op 2 decimalen
 * (round2 normaliseert ook -0). Géén instrument-metadata nodig (plan C8).
 * Null wanneer stop op entry ligt of een prijs onbruikbaar is.
 */
export function plannedRR(entry: number, stop: number, target: number): number | null {
  if (!isFiniteNumber(entry) || !isFiniteNumber(stop) || !isFiniteNumber(target)) return null;
  const risk = Math.abs(entry - stop);
  if (risk === 0) return null;
  return round2(Math.abs(target - entry) / risk);
}

/** Afstand tussen twee prijzen in pips, afgerond op 1 decimaal. Null bij pipSize ≤ 0. */
export function pipsBetween(a: number, b: number, pipSize: number): number | null {
  if (!isFiniteNumber(a) || !isFiniteNumber(b) || !isFiniteNumber(pipSize) || pipSize <= 0) return null;
  return Math.round((Math.abs(a - b) / pipSize) * 10) / 10;
}
