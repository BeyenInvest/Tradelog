import type { Pair } from "@/lib/constants";
import { normalizeSymbol } from "./symbols";
import { resolveResultaatPct, dealToImportRow } from "./mapToTrade";
import type { ImportBroker, ImportTradeRow, ParsedDeal } from "./types";

/** Placeholder pair for a non-forex import — the real symbol lives in `instrument`; the not-null forex `pair` column keeps this default, which non-forex views ignore (cyclus 7). Mirrors the trade form's hidden pair default. */
const NON_FOREX_PAIR_PLACEHOLDER: Pair = "EURUSD";

export interface PrepareOptions {
  /** User-supplied raw-symbol → Pair overrides for symbols normalizeSymbol can't resolve. */
  pairMap: Record<string, Pair>;
  /** Single account balance to fall back on when a deal has no return %/running balance. null = not provided yet. */
  accountBalance: number | null;
  /** import_refs already in the DB for this user — matches are skipped as duplicates. */
  existingImportRefs: Set<string>;
  /**
   * Whether the active journal trades forex (cyclus 7). Forex: every symbol must
   * resolve to a Pair (normalizeSymbol/pairMap), unresolved ones go to the manual
   * mapping step. Non-forex: the raw symbol is kept verbatim as the instrument, no
   * Pair mapping needed, so `unknownSymbols` is always empty. Defaults to true —
   * broker import has always been forex-only until now.
   */
  forexJournal?: boolean;
}

export interface PreparedImport {
  /** Fully resolved, new rows ready to insert. */
  rows: ImportTradeRow[];
  /** Distinct raw symbols that couldn't be resolved to a Pair — the manual mapping step. */
  unknownSymbols: string[];
  /** True when at least one deal needs an account balance to compute its % (no return/running balance in the export). */
  needsBalance: boolean;
  /** Deals skipped as duplicates — already in the DB, or a repeat of an earlier deal in this same file. */
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
  const forexJournal = opts.forexJournal ?? true;
  const rows: ImportTradeRow[] = [];
  const unknownSet = new Set<string>();
  const unknownSymbols: string[] = [];
  // Refs already accepted in THIS batch. The DB has a partial unique index on
  // (user, import_ref), so a duplicate ref within one file would make the single
  // bulk INSERT fail as a whole — dedup here so a repeat becomes a counted skip.
  const batchRefs = new Set<string>();
  let needsBalance = false;
  let duplicateCount = 0;
  let undatedCount = 0;

  for (const deal of deals) {
    const importRef = `${broker}:${deal.ticket}`;
    if (opts.existingImportRefs.has(importRef) || batchRefs.has(importRef)) {
      duplicateCount++;
      continue;
    }

    // Resolve pair + instrument per journal type. Forex: symbol must map to a Pair
    // (unresolved → manual mapping). Non-forex: keep the raw symbol as instrument.
    let pair: Pair;
    let instrument: string;
    if (forexJournal) {
      const resolved = normalizeSymbol(deal.symbol) ?? opts.pairMap[deal.symbol] ?? null;
      if (!resolved) {
        if (!unknownSet.has(deal.symbol)) {
          unknownSet.add(deal.symbol);
          unknownSymbols.push(deal.symbol);
        }
        continue;
      }
      pair = resolved;
      instrument = resolved;
    } else {
      instrument = deal.symbol.trim();
      if (!instrument) continue; // a nameless symbol can't be a meaningful instrument
      pair = NON_FOREX_PAIR_PLACEHOLDER;
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

    batchRefs.add(importRef);
    rows.push(dealToImportRow(deal, pair, instrument, pct, broker));
  }

  return { rows, unknownSymbols, needsBalance, duplicateCount, undatedCount };
}
