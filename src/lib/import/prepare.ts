import type { Pair } from "@/lib/constants";
import { normalizeSymbol } from "./symbols";
import { resolveResultaatPct, dealToImportRow } from "./mapToTrade";
import type { ImportBroker, ImportTradeRow, ParsedDeal } from "./types";

export interface PrepareOptions {
  /** User-supplied raw-symbol → Pair overrides for symbols normalizeSymbol can't resolve. */
  pairMap: Record<string, Pair>;
  /** Single account balance to fall back on when a deal has no return %/running balance. null = not provided yet. */
  accountBalance: number | null;
  /** import_refs already in the DB for this user — matches are skipped as duplicates. */
  existingImportRefs: Set<string>;
}

export interface PreparedImport {
  /** Fully resolved, new rows ready to insert. */
  rows: ImportTradeRow[];
  /** Distinct raw symbols that couldn't be resolved to a Pair — the manual mapping step. */
  unknownSymbols: string[];
  /** True when at least one deal needs an account balance to compute its % (no return/running balance in the export). */
  needsBalance: boolean;
  /** Deals already imported before (import_ref already present). */
  duplicateCount: number;
  /** Deals with no usable date at all — skipped. */
  undatedCount: number;
}

/**
 * Pure, idempotent import planner. The modal calls this after parsing and again
 * every time the user maps a symbol or enters a balance, re-deriving the whole
 * preview from the same deals — no hidden state. A deal only becomes an
 * insertable row once it clears, in order: not-a-duplicate → known pair →
 * has a date → has a derivable %.
 */
export function prepareImport(deals: ParsedDeal[], broker: ImportBroker, opts: PrepareOptions): PreparedImport {
  const rows: ImportTradeRow[] = [];
  const unknownSet = new Set<string>();
  const unknownSymbols: string[] = [];
  let needsBalance = false;
  let duplicateCount = 0;
  let undatedCount = 0;

  for (const deal of deals) {
    const importRef = `${broker}:${deal.ticket}`;
    if (opts.existingImportRefs.has(importRef)) {
      duplicateCount++;
      continue;
    }

    const pair = normalizeSymbol(deal.symbol) ?? opts.pairMap[deal.symbol] ?? null;
    if (!pair) {
      if (!unknownSet.has(deal.symbol)) {
        unknownSet.add(deal.symbol);
        unknownSymbols.push(deal.symbol);
      }
      continue;
    }

    if (!deal.openTime && !deal.closeTime) {
      undatedCount++;
      continue;
    }

    const pct = resolveResultaatPct(deal, opts.accountBalance);
    if (pct == null) {
      needsBalance = true;
      continue;
    }

    rows.push(dealToImportRow(deal, pair, pct, broker));
  }

  return { rows, unknownSymbols, needsBalance, duplicateCount, undatedCount };
}
