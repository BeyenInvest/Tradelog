import type { ResultUnit } from "./constants";
import type { Trade } from "./types";
import { riskPct } from "./stats/core";

/** Consistent EUR formatting (nl-BE grouping/decimal style) for account sizes, payouts, etc. */
export function formatEUR(n: number): string {
  return n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * The numeric value a result renders as in the given eenheid (Fase J) — callers
 * derive sign/tone (win/loss/be kleur) from this so the colour always matches the
 * number on screen. With mixed risk-percentages a total in R can differ in sign
 * from the same total in %, so never colour on `pct` while displaying R.
 *
 * Currency without a concrete `amount` falls back to % (the honest fallback until
 * a geld-bron per trade bestaat — sub-slice 4/5); same for R without `rMultiple`.
 */
export function resultDisplayValue(pct: number, unit: ResultUnit, ctx?: { rMultiple?: number; amount?: number }): number {
  if (unit === "R" && ctx?.rMultiple != null) return ctx.rMultiple;
  if (unit === "currency" && ctx?.amount != null) return ctx.amount;
  return pct;
}

/**
 * Central display conversion for the resultaat-eenheid voorkeur (profiles.result_unit,
 * Fase J): "+1.10%", "+1.10R" of "+1 234,56". Puur weergave — stats en opslag blijven
 * in %; pass the al-berekende `rMultiple`/`amount` via ctx (uit stats-helpers zoals
 * `rMultiple()`/`computeRStats()`), hier wordt niet gerekend. Falls back to % when
 * the unit's context value is missing (see resultDisplayValue).
 */
/** Het eenheid-achtervoegsel voor compacte plekken (kalendercellen, tabellen, chart-tooltips): "R" in R-modus, anders "%". Currency heeft geen suffix — gebruik daar formatAggregate. */
export function resultUnitSuffix(unit: ResultUnit): string {
  return unit === "R" ? "R" : "%";
}

/**
 * Weergavelaag-conversie voor aggregaties (Fase J): geeft de trade-lijst terug met
 * `resultaat_pct` vervangen door de waarde in de gekozen eenheid — de ongerondde
 * R-ratio (resultaat_pct / riskPct) in R-modus, het geldbedrag (resultaat_pct/100 ×
 * saldo, het currency-MVP) in geld-modus. Hiermee rekenen de bestaande %-gebaseerde
 * aggregatie-functies (breakdownBy, groupIntoSeries, computeEquityCurve) hun sommen
 * in de eenheid uit ZONDER dat stats/* wijzigt — de som-dan-afronden volgorde blijft
 * gelijk aan computeRStats. Alleen voor weergave gebruiken, nooit terugschrijven.
 * `saldo` komt uit useResultDisplay(); zonder saldo blijft currency onvertaald
 * (de provider levert dan al 'percent' als effectieve eenheid).
 */
export function tradesInResultUnit<T extends Pick<Trade, "resultaat_pct" | "risk_pct">>(
  trades: T[],
  unit: ResultUnit,
  saldo?: number | null
): T[] {
  if (unit === "R") return trades.map((t) => ({ ...t, resultaat_pct: t.resultaat_pct / riskPct(t) }));
  if (unit === "currency" && saldo != null) return trades.map((t) => ({ ...t, resultaat_pct: (t.resultaat_pct / 100) * saldo }));
  return trades;
}

/**
 * Formatteert een AL naar de eenheid geconverteerd totaal (uit tradesInResultUnit-
 * gevoede aggregaties): "+1.1%", "+1.1R" of "+€1.234,56". `decimals` dwingt vaste
 * decimalen af voor compacte plekken (kalendercellen); zonder decimals wordt het
 * getal geprint zoals het (al ge-round2'd) binnenkomt, en geld altijd via formatEUR.
 */
export function formatAggregate(v: number, unit: ResultUnit, opts?: { decimals?: number }): string {
  if (unit === "currency") {
    const abs = opts?.decimals != null ? Math.abs(v).toFixed(opts.decimals) : formatEUR(Math.abs(v));
    return `${v > 0 ? "+" : v < 0 ? "-" : ""}€${abs}`;
  }
  const num = opts?.decimals != null ? v.toFixed(opts.decimals) : String(v);
  return `${v > 0 ? "+" : ""}${num}${resultUnitSuffix(unit)}`;
}

export function formatResult(pct: number, unit: ResultUnit, ctx?: { rMultiple?: number; amount?: number }): string {
  if (unit === "R" && ctx?.rMultiple != null) {
    return `${ctx.rMultiple > 0 ? "+" : ""}${ctx.rMultiple.toFixed(2)}R`;
  }
  if (unit === "currency" && ctx?.amount != null) {
    return formatAggregate(ctx.amount, "currency");
  }
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/**
 * Display string for a profit factor (see computeProfitFactor): "—" when null
 * (nothing decisive yet), "∞" when Infinity (winners, no losers), else 2 decimals.
 * Both glyphs are language-neutral, so this needs no i18n.
 */
export function formatProfitFactor(pf: number | null): string {
  if (pf == null) return "—";
  if (!Number.isFinite(pf)) return "∞";
  return pf.toFixed(2);
}

/** BCP47 locale for date formatting, following the active UI language (pass i18n.language). */
export function dateLocale(lang: string): string {
  return lang.startsWith("nl") ? "nl-BE" : "en-GB";
}

/** Localized full month name for a 0-based month index (0 = January), in the given BCP47 locale. */
export function monthName(month0: number, locale: string): string {
  return new Date(2000, month0, 1).toLocaleDateString(locale, { month: "long" });
}
