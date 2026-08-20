import type { ResultUnit } from "./constants";
import type { Trade } from "./types";
import { closedTrades, computeRStats, riskPct, takenTrades, type ClosedTrade } from "./stats/core";

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
  const eff = effectiveUnit(unit, ctx);
  if (eff === "R") return ctx!.rMultiple!; // effectiveUnit garandeert aanwezigheid
  if (eff === "currency") return ctx!.amount!;
  return pct;
}

/**
 * De eenheid die — gegeven de beschikbare ctx-waarden — daadwerkelijk gerenderd
 * wordt: R zonder rMultiple en currency zonder amount vallen op % terug. Eén
 * plek voor die fallback-regels, zodat resultDisplayValue (de waarde, en dus de
 * win/loss-kleur) en formatResult (de string) nooit uiteen kunnen lopen.
 */
function effectiveUnit(unit: ResultUnit, ctx?: { rMultiple?: number; amount?: number }): ResultUnit {
  if (unit === "R" && ctx?.rMultiple != null) return "R";
  if (unit === "currency" && ctx?.amount != null) return "currency";
  return "percent";
}

/** Het eenheid-achtervoegsel voor compacte plekken (kalendercellen, tabellen, chart-tooltips): "R" in R-modus, anders "%". Currency heeft geen suffix — gebruik daar formatAggregate. */
export function resultUnitSuffix(unit: ResultUnit): string {
  return unit === "R" ? "R" : "%";
}

/** Geldbedrag voor een %-resultaat (het currency-MVP: pct/100 × saldo); undefined zonder saldo — resultDisplayValue/formatResult vallen dan terug op %. */
export function pctToAmount(pct: number, saldo: number | null | undefined): number | undefined {
  return saldo != null ? (pct / 100) * saldo : undefined;
}

/**
 * De weergavewaarde van één trade in de gekozen eenheid — dezelfde regels als
 * tradesInResultUnit, voor plekken die zelf per trade sommeren (kalender-
 * dagtotalen) in plaats van een geconverteerde lijst te aggregeren.
 */
export function resultInUnit<T extends Pick<ClosedTrade, "resultaat_pct" | "risk_pct">>(
  trade: T,
  unit: ResultUnit,
  saldo?: number | null
): number {
  if (unit === "R") return trade.resultaat_pct / riskPct(trade);
  if (unit === "currency" && saldo != null) return (trade.resultaat_pct / 100) * saldo;
  return trade.resultaat_pct;
}

/**
 * Ctx voor het totaal van een trade-groep (TradeList, ReviewTradeGroups): rekent
 * alleen uit wat de eenheid nodig heeft (geen R-som voor %-kijkers). takenTrades
 * spiegelt realResultaatTotal's missed-exclusie, zodat de R-som over dezelfde
 * trades gaat als de %-som.
 */
export function groupResultCtx(
  trades: Trade[],
  totalPct: number,
  unit: ResultUnit,
  saldo: number | null
): { rMultiple?: number; amount?: number } {
  if (unit === "R") return { rMultiple: computeRStats(closedTrades(takenTrades(trades))).totalR };
  if (unit === "currency") return { amount: pctToAmount(totalPct, saldo) };
  return {};
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
export function tradesInResultUnit<T extends Pick<ClosedTrade, "resultaat_pct" | "risk_pct">>(
  trades: T[],
  unit: ResultUnit,
  saldo?: number | null
): T[] {
  if (unit === "percent" || (unit === "currency" && saldo == null)) return trades;
  return trades.map((t) => ({ ...t, resultaat_pct: resultInUnit(t, unit, saldo) }));
}

/**
 * Formatteert een AL naar de eenheid geconverteerd totaal (uit tradesInResultUnit-
 * gevoede aggregaties): "+1.1%", "+1.1R" of "+€1.234,56". `decimals` dwingt vaste
 * decimalen af voor compacte plekken (kalendercellen); zonder decimals wordt het
 * getal geprint zoals het (al ge-round2'd) binnenkomt, en geld altijd via formatEUR.
 */
export function formatAggregate(v: number, unit: ResultUnit, opts?: { decimals?: number }): string {
  // -0/float-dust-normalisatie (zelfde invariant als round2 in stats/core): een
  // rauwe som als 0.3-0.2-0.1 is -2.8e-17 en zou anders als "-0.0R"/"-€0" met
  // verliesteken renderen. Alles dat op weergaveprecisie op 0 afrondt, ís 0.
  const digits = opts?.decimals ?? 2;
  if (Math.round(v * 10 ** digits) === 0) v = 0;
  if (unit === "currency") {
    // toLocaleString i.p.v. toFixed zodat de duizendtal-groepering (nl-BE, zoals
    // formatEUR) ook met afgedwongen decimalen behouden blijft: "+€12.500", niet "+€12500".
    const abs =
      opts?.decimals != null
        ? Math.abs(v).toLocaleString("nl-BE", { minimumFractionDigits: opts.decimals, maximumFractionDigits: opts.decimals })
        : formatEUR(Math.abs(v));
    return `${v > 0 ? "+" : v < 0 ? "-" : ""}€${abs}`;
  }
  const num = opts?.decimals != null ? v.toFixed(opts.decimals) : String(v);
  return `${v > 0 ? "+" : ""}${num}${resultUnitSuffix(unit)}`;
}

/**
 * Central display conversion for the resultaat-eenheid voorkeur (profiles.result_unit,
 * Fase J): "+1.10%", "+1.10R" of "+€1.234,56". Puur weergave — stats en opslag
 * blijven in %; pass the al-berekende `rMultiple`/`amount` via ctx (uit stats-
 * helpers zoals `rMultiple()`/`computeRStats()`, of pctToAmount), hier wordt niet
 * gerekend. Waarde én fallback komen uit resultDisplayValue/effectiveUnit, zodat
 * de string altijd bij dezelfde waarde hoort als de win/loss-kleur van de caller.
 */
export function formatResult(pct: number, unit: ResultUnit, ctx?: { rMultiple?: number; amount?: number }): string {
  const eff = effectiveUnit(unit, ctx);
  const v = resultDisplayValue(pct, unit, ctx);
  if (eff === "R") return `${v > 0 ? "+" : ""}${v.toFixed(2)}R`;
  if (eff === "currency") return formatAggregate(v, "currency");
  return `${v > 0 ? "+" : ""}${v}%`;
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
