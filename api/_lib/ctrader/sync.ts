// Orchestratie: OAuth-tokens (HTTP) + gesloten posities ophalen (WebSocket).
// Zie docs/plan-ctrader-sync.md §2.

import { PT, openSession, type CtraderSession, type WsFactory } from "./protocol.js";
import { buildClosedPositions, positionsMissingOpen, type ClosedPosition, type RawDeal } from "./positions.js";

const TOKEN_URL = "https://openapi.ctrader.com/apps/token";
const AUTHORIZE_URL = "https://id.ctrader.com/my/settings/openapi/grantingaccess/";
/** cTrader weigert deal-vensters > 1 week. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Max weken per sync-aanroep (blijft ruim binnen de functie-timeout); de rest volgt bij de volgende sync. */
const MAX_WEEKS_PER_SYNC = 26;
/** Historische requests zijn begrensd op ~5/s. */
const HISTORICAL_GAP_MS = 250;

export interface CtraderAppConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function authorizeUrl(cfg: CtraderAppConfig, state: string): string {
  const qs = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    // Alleen lezen: Beyen plaatst nooit orders, dus geen "trading"-scope.
    scope: "accounts",
    product: "web",
    state,
  });
  return `${AUTHORIZE_URL}?${qs}`;
}

async function tokenRequest(params: Record<string, string>, fetchImpl: typeof fetch): Promise<TokenSet> {
  const res = await fetchImpl(`${TOKEN_URL}?${new URLSearchParams(params)}`, {
    headers: { Accept: "application/json" },
  });
  const body = (await res.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    errorCode?: string;
    description?: string;
  };
  if (!res.ok || !body.accessToken || !body.refreshToken) {
    throw new Error(`cTrader-token: ${body.errorCode ?? res.status} ${body.description ?? ""}`.trim());
  }
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    expiresAt: Date.now() + (body.expiresIn ?? 2_628_000) * 1000,
  };
}

export function exchangeCode(cfg: CtraderAppConfig, code: string, fetchImpl: typeof fetch = fetch): Promise<TokenSet> {
  return tokenRequest(
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    },
    fetchImpl
  );
}

export function refreshTokens(cfg: CtraderAppConfig, refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<TokenSet> {
  return tokenRequest(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    },
    fetchImpl
  );
}

export interface CtraderAccountInfo {
  ctidTraderAccountId: string;
  isLive: boolean;
  traderLogin: string | null;
  brokerName: string | null;
}

async function appAuth(session: CtraderSession, cfg: CtraderAppConfig) {
  await session.request(PT.APPLICATION_AUTH_REQ, { clientId: cfg.clientId, clientSecret: cfg.clientSecret });
}

/**
 * Lijst de accounts onder een token. De lijst is identiek op live/demo; we
 * vragen 'm op het live-endpoint (één verbinding).
 */
export async function listAccounts(
  cfg: CtraderAppConfig,
  accessToken: string,
  wsFactory?: WsFactory
): Promise<CtraderAccountInfo[]> {
  const session = await openSession(true, wsFactory);
  try {
    await appAuth(session, cfg);
    const res = await session.request<{ ctidTraderAccount?: Array<Record<string, unknown>> }>(
      PT.GET_ACCOUNTS_BY_TOKEN_REQ,
      { accessToken }
    );
    return (res.ctidTraderAccount ?? []).map((a) => ({
      ctidTraderAccountId: String(a.ctidTraderAccountId),
      isLive: a.isLive === true,
      traderLogin: a.traderLogin != null ? String(a.traderLogin) : null,
      brokerName: typeof a.brokerTitleShort === "string" ? a.brokerTitleShort : null,
    }));
  } finally {
    session.close();
  }
}

export interface FetchPositionsResult {
  positions: ClosedPosition[];
  stillOpen: number;
  /** Cursor-voorstel: tot hier is alles opgehaald (ms). */
  fetchedUntil: number;
  /** True als het venster is afgekapt (MAX_WEEKS_PER_SYNC) — de client synct dan nog eens. */
  hasMore: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchClosedPositions(
  cfg: CtraderAppConfig,
  account: { ctidTraderAccountId: string; isLive: boolean; accessToken: string },
  fromMs: number,
  nowMs: number = Date.now(),
  wsFactory?: WsFactory
): Promise<FetchPositionsResult> {
  const session = await openSession(account.isLive, wsFactory);
  // int64 als string meesturen is veilig (protobuf-JSON accepteert beide) en
  // voorkomt precisieverlies bij grote account-id's.
  const ctidTraderAccountId = Number(account.ctidTraderAccountId);
  try {
    await appAuth(session, cfg);
    await session.request(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId, accessToken: account.accessToken });

    const symbolsRes = await session.request<{
      symbol?: Array<{ symbolId?: unknown; symbolName?: unknown }>;
      archivedSymbol?: Array<{ symbolId?: unknown; name?: unknown }>;
    }>(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId, includeArchivedSymbols: true });
    const symbolNames = new Map<string, string>();
    for (const s of symbolsRes.symbol ?? []) symbolNames.set(String(s.symbolId), String(s.symbolName ?? ""));
    for (const s of symbolsRes.archivedSymbol ?? []) {
      if (!symbolNames.has(String(s.symbolId))) symbolNames.set(String(s.symbolId), String(s.name ?? ""));
    }

    const traderRes = await session.request<{ trader?: { moneyDigits?: number } }>(PT.TRADER_REQ, { ctidTraderAccountId });
    const moneyDigits = traderRes.trader?.moneyDigits ?? 2;

    const reconcile = await session.request<{ position?: Array<{ positionId?: unknown }> }>(PT.RECONCILE_REQ, {
      ctidTraderAccountId,
    });
    const openIds = new Set((reconcile.position ?? []).map((p) => String(p.positionId)));

    const maxTo = Math.min(nowMs, fromMs + MAX_WEEKS_PER_SYNC * WEEK_MS);
    const deals: RawDeal[] = [];
    let cursor = fromMs;
    while (cursor < maxTo) {
      const windowEnd = Math.min(cursor + WEEK_MS, maxTo);
      let from = cursor;
      // hasMore binnen één week: verder vanaf de laatste executionTimestamp.
      for (let guard = 0; guard < 20; guard++) {
        const res = await session.request<{ deal?: RawDeal[]; hasMore?: boolean }>(PT.DEAL_LIST_REQ, {
          ctidTraderAccountId,
          fromTimestamp: from,
          toTimestamp: windowEnd,
        });
        const batch = res.deal ?? [];
        deals.push(...batch);
        await sleep(HISTORICAL_GAP_MS);
        if (!res.hasMore || batch.length === 0) break;
        const lastTs = Math.max(...batch.map((d) => Number(d.executionTimestamp) || from));
        if (lastTs <= from) break;
        from = lastTs; // dedup op dealId vangt de grens-deal op
      }
      cursor = windowEnd;
    }

    // Posities die vóór het venster openden: volledige deal-historiek ophalen
    // (opening + eventuele eerdere gedeeltelijke sluitingen).
    for (const positionId of positionsMissingOpen(deals)) {
      if (openIds.has(positionId)) continue;
      try {
        const res = await session.request<{ deal?: RawDeal[] }>(PT.DEAL_LIST_BY_POSITION_REQ, {
          ctidTraderAccountId,
          positionId: Number(positionId),
        });
        deals.push(...(res.deal ?? []));
      } catch {
        // Geen aanvulling → positie valt terug op de eerste sluit-tijd als open-tijd.
      }
      await sleep(HISTORICAL_GAP_MS);
    }

    const { positions, stillOpen } = buildClosedPositions(deals, symbolNames, openIds, moneyDigits);
    return { positions, stillOpen, fetchedUntil: maxTo, hasMore: maxTo < nowMs };
  } finally {
    session.close();
  }
}
