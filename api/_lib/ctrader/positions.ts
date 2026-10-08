// Pure omzetting cTrader-deals → gesloten posities (plan-ctrader-sync §2.3).
//
// cTrader boekt elke vulling als een deal: de opening-deal heeft geen
// closePositionDetail, elke (gedeeltelijke) sluiting wel. Eén journal-trade =
// één positie: alle sluit-deals van die positie opgeteld. Posities die nog
// (deels) open staan worden overgeslagen tot ze volledig dicht zijn.
//
// Geldbedragen zijn integers geschaald met 10^moneyDigits. Int64-velden kunnen
// in JSON als string binnenkomen; enums als nummer of als naam — beide gedekt.

export interface RawDeal {
  dealId?: number | string;
  positionId?: number | string;
  symbolId?: number | string;
  executionTimestamp?: number | string;
  tradeSide?: number | string;
  dealStatus?: number | string;
  moneyDigits?: number;
  closePositionDetail?: {
    grossProfit?: number | string;
    swap?: number | string;
    commission?: number | string;
    balance?: number | string;
    moneyDigits?: number;
    pnlConversionFee?: number | string;
  };
}

/** Wire-formaat naar de client (src/lib/ctrader/mapDeals.ts zet het om naar ParsedDeal). */
export interface ClosedPosition {
  positionId: string;
  symbol: string;
  side: "buy" | "sell";
  openTs: number;
  closeTs: number;
  /** Netto (bruto + swap − commissie) in accountvaluta. */
  netPnl: number;
  /** Saldo na de laatste sluit-deal. */
  balanceAfter: number | null;
  /** netPnl / saldo vóór de eerste sluit-deal × 100. */
  returnPct: number | null;
}

const num = (v: unknown): number => (v == null || v === "" ? NaN : Number(v));

function sideOf(v: unknown): "buy" | "sell" | null {
  if (v === 1 || v === "1" || v === "BUY") return "buy";
  if (v === 2 || v === "2" || v === "SELL") return "sell";
  return null;
}

/** FILLED(2) / PARTIALLY_FILLED(3) tellen; afgewezen/gemiste deals niet. */
function isFilled(v: unknown): boolean {
  if (v == null) return true;
  return v === 2 || v === 3 || v === "2" || v === "3" || v === "FILLED" || v === "PARTIALLY_FILLED";
}

function scale(v: unknown, digits: number): number {
  const n = num(v);
  return Number.isFinite(n) ? n / 10 ** digits : 0;
}

export function buildClosedPositions(
  deals: RawDeal[],
  symbolNames: Map<string, string>,
  openPositionIds: Set<string>,
  defaultMoneyDigits = 2
): { positions: ClosedPosition[]; stillOpen: number } {
  const byPosition = new Map<string, RawDeal[]>();
  const seenDeal = new Set<string>();
  for (const d of deals) {
    if (!isFilled(d.dealStatus) || d.positionId == null) continue;
    const dealKey = String(d.dealId ?? `${d.positionId}:${d.executionTimestamp}`);
    if (seenDeal.has(dealKey)) continue; // chunk-overlap / by-position-aanvulling
    seenDeal.add(dealKey);
    const pid = String(d.positionId);
    const list = byPosition.get(pid) ?? [];
    list.push(d);
    byPosition.set(pid, list);
  }

  const positions: ClosedPosition[] = [];
  let stillOpen = 0;
  for (const [pid, list] of byPosition) {
    const closes = list
      .filter((d) => d.closePositionDetail)
      .sort((a, b) => num(a.executionTimestamp) - num(b.executionTimestamp));
    if (closes.length === 0) continue; // alleen geopend in dit venster
    if (openPositionIds.has(pid)) {
      stillOpen++;
      continue;
    }
    const opening = list
      .filter((d) => !d.closePositionDetail)
      .sort((a, b) => num(a.executionTimestamp) - num(b.executionTimestamp))[0];

    let net = 0;
    for (const c of closes) {
      const cpd = c.closePositionDetail!;
      const digits = cpd.moneyDigits ?? c.moneyDigits ?? defaultMoneyDigits;
      // Commissie en conversie-fee zijn altijd kosten; het teken verschilt per bron.
      net +=
        scale(cpd.grossProfit, digits) +
        scale(cpd.swap, digits) -
        Math.abs(scale(cpd.commission, digits)) -
        Math.abs(scale(cpd.pnlConversionFee, digits));
    }

    const first = closes[0];
    const last = closes[closes.length - 1];
    const firstDigits = first.closePositionDetail!.moneyDigits ?? first.moneyDigits ?? defaultMoneyDigits;
    const lastDigits = last.closePositionDetail!.moneyDigits ?? last.moneyDigits ?? defaultMoneyDigits;
    const firstBalance = num(first.closePositionDetail!.balance);
    const lastBalance = num(last.closePositionDetail!.balance);

    // Saldo vóór de eerste sluiting = saldo erna − netto van díe sluiting.
    let returnPct: number | null = null;
    if (Number.isFinite(firstBalance)) {
      const fc = first.closePositionDetail!;
      const firstNet =
        scale(fc.grossProfit, firstDigits) +
        scale(fc.swap, firstDigits) -
        Math.abs(scale(fc.commission, firstDigits)) -
        Math.abs(scale(fc.pnlConversionFee, firstDigits));
      const before = firstBalance / 10 ** firstDigits - firstNet;
      if (before > 0) returnPct = Math.round((net / before) * 100 * 100) / 100;
    }

    const closeSide = sideOf(last.tradeSide);
    const side = sideOf(opening?.tradeSide) ?? (closeSide === "buy" ? "sell" : closeSide === "sell" ? "buy" : null);
    if (!side) continue;

    const closeTs = num(last.executionTimestamp);
    const openTs = opening ? num(opening.executionTimestamp) : num(first.executionTimestamp);
    if (!Number.isFinite(closeTs) || !Number.isFinite(openTs)) continue;

    const symbolId = String(first.symbolId ?? opening?.symbolId ?? "");
    positions.push({
      positionId: pid,
      symbol: symbolNames.get(symbolId) ?? "",
      side,
      openTs,
      closeTs,
      netPnl: Math.round(net * 100) / 100,
      balanceAfter: Number.isFinite(lastBalance) ? lastBalance / 10 ** lastDigits : null,
      returnPct,
    });
  }

  positions.sort((a, b) => a.closeTs - b.closeTs);
  return { positions, stillOpen };
}

/** Posities met sluit-deals maar zonder opening-deal in de set — die hebben een by-position-aanvulling nodig. */
export function positionsMissingOpen(deals: RawDeal[]): string[] {
  const hasOpen = new Set<string>();
  const hasClose = new Set<string>();
  for (const d of deals) {
    if (d.positionId == null || !isFilled(d.dealStatus)) continue;
    (d.closePositionDetail ? hasClose : hasOpen).add(String(d.positionId));
  }
  return [...hasClose].filter((pid) => !hasOpen.has(pid));
}
