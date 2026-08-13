/** Consistent EUR formatting (nl-BE grouping/decimal style) for account sizes, payouts, etc. */
export function formatEUR(n: number): string {
  return n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
