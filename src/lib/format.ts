/** Consistent EUR formatting (nl-BE grouping/decimal style) for account sizes, payouts, etc. */
export function formatEUR(n: number): string {
  return n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** BCP47 locale for date formatting, following the active UI language (pass i18n.language). */
export function dateLocale(lang: string): string {
  return lang.startsWith("nl") ? "nl-BE" : "en-GB";
}
