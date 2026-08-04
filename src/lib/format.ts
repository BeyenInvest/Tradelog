/** Consistent EUR formatting (nl-BE grouping/decimal style) for account sizes, payouts, etc. */
export function formatEUR(n: number): string {
  return n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
