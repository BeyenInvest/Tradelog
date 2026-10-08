// Client-kant van de cTrader-koppeling (docs/plan-ctrader-sync.md).
//
// De server (api/ctrader.ts) levert gesloten posities; hier worden ze omgezet
// naar de broker-neutrale ParsedDeal zodat ze exact dezelfde import-pipeline
// (prepareImport → createTradesBulk, dedup op import_ref) doorlopen als een
// CSV-import. Datum/tijd worden wall-clock in de profiel-tijdzone, net als bij
// handmatig loggen en de TV-extensie.

import { supabase } from "@/lib/supabase";
import { wallClockInTimezone } from "@/lib/wallClock";
import type { ParsedDeal } from "@/lib/import";

/** Spiegel van ClosedPosition in api/_lib/ctrader/positions.ts (wire-formaat). */
export interface CtraderPosition {
  positionId: string;
  symbol: string;
  side: "buy" | "sell";
  openTs: number;
  closeTs: number;
  netPnl: number;
  balanceAfter: number | null;
  returnPct: number | null;
}

export interface CtraderSyncResponse {
  positions: CtraderPosition[];
  stillOpen: number;
  fetchedUntil: number;
  hasMore: boolean;
}

export interface BrokerAccount {
  id: string;
  connection_id: string;
  provider: "ctrader";
  external_account_id: number;
  is_live: boolean;
  account_login: string | null;
  broker_name: string | null;
  methodology_id: string | null;
  enabled: boolean;
  synced_until: string;
  last_synced_at: string | null;
}

export const BROKER_ACCOUNT_COLUMNS =
  "id, connection_id, provider, external_account_id, is_live, account_login, broker_name, methodology_id, enabled, synced_until, last_synced_at";

export class CtraderRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function callApi<T>(action: string, body?: Record<string, string>): Promise<T> {
  const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
  if (!accessToken) throw new CtraderRequestError(401, "no session");
  const res = await fetch(`/api/ctrader?action=${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new CtraderRequestError(res.status, json.error ?? `HTTP ${res.status}`);
  return json;
}

export const ctraderApi = {
  start: () => callApi<{ url: string }>("start"),
  sync: (accountId: string) => callApi<CtraderSyncResponse>("sync", { accountId }),
  disconnect: (connectionId: string) => callApi<{ ok: true }>("disconnect", { connectionId }),
};

/**
 * Posities → ParsedDeal. Ticket = account:positie, zodat import_ref
 * (`ctrader:<account>:<positie>`) uniek blijft over meerdere gekoppelde accounts
 * en nooit botst met een CSV-import (`ctrader:<order-id>`).
 */
export function positionsToDeals(positions: CtraderPosition[], externalAccountId: number | string, timeZone: string): ParsedDeal[] {
  return positions.map((p) => {
    const open = wallClockInTimezone(p.openTs, timeZone);
    const close = wallClockInTimezone(p.closeTs, timeZone);
    return {
      ticket: `${externalAccountId}:${p.positionId}`,
      symbol: p.symbol,
      direction: p.side,
      openTime: open?.date ?? null,
      closeTime: close?.date ?? null,
      openClock: open?.time ?? null,
      pnlAmount: p.netPnl,
      returnPct: p.returnPct,
      balanceAfter: p.balanceAfter,
      raw: { positionId: p.positionId, symbol: p.symbol },
    };
  });
}
