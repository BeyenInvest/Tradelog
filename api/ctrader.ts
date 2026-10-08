// cTrader-koppeling — app-endpoint (plan-ctrader-sync §3).
//
// POST /api/ctrader?action=start       → { url } — OAuth-URL met gesigneerde state
// POST /api/ctrader?action=sync        → body { accountId } → gesloten posities sinds de cursor
// POST /api/ctrader?action=disconnect  → body { connectionId } → grant + accounts weg
//
// Altijd met de eigen Supabase-JWT (Authorization: Bearer). De cTrader-tokens
// leven versleuteld in broker_connections en verlaten deze functie nooit; de
// client krijgt alleen de genormaliseerde posities en schrijft zélf de trades
// (via RLS + de bestaande import-pipeline, dedup op import_ref).
// Achter betaFeatures (= beta_features OR admin), zoals elke nieuwe feature.

import { readAppConfig } from "./_lib/ctrader/config.js";
import { decryptToken, encryptToken, signState } from "./_lib/ctrader/secrets.js";
import {
  authorizeUrl,
  fetchClosedPositions,
  refreshTokens,
  type FetchPositionsResult,
  type TokenSet,
} from "./_lib/ctrader/sync.js";

interface VercelStyleRequest {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelStyleResponse {
  status(code: number): VercelStyleResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

export interface SyncAccountRow {
  id: string;
  connection_id: string;
  external_account_id: string;
  is_live: boolean;
  enabled: boolean;
  synced_until: string;
}

export interface ConnectionRow {
  id: string;
  access_token_enc: string;
  refresh_token_enc: string;
  token_expires_at: string;
}

export interface CtraderDeps {
  getUser(jwt: string): Promise<{ id: string; beta: boolean } | null>;
  getAccount(userId: string, accountId: string): Promise<SyncAccountRow | null>;
  getConnection(userId: string, connectionId: string): Promise<ConnectionRow | null>;
  saveTokens(connectionId: string, tokens: { access_token_enc: string; refresh_token_enc: string; token_expires_at: string }): Promise<void>;
  markSynced(accountId: string): Promise<void>;
  deleteConnection(userId: string, connectionId: string): Promise<boolean>;
  refresh(refreshToken: string): Promise<TokenSet>;
  fetchPositions(account: { ctidTraderAccountId: string; isLive: boolean; accessToken: string }, fromMs: number): Promise<FetchPositionsResult>;
  authorizeUrl(state: string): string;
  secret: string;
  now?(): number;
}

const STATE_TTL_MS = 10 * 60 * 1000;
/** Ververs het access-token als het binnen 2 dagen verloopt (levensduur ~30 dagen). */
const REFRESH_MARGIN_MS = 2 * 24 * 60 * 60 * 1000;
const SYNC_RATE_MAX = 12;
const SYNC_RATE_WINDOW_MS = 5 * 60 * 1000;

function bodyField(body: unknown, key: string): string | null {
  let obj = body;
  if (typeof body === "string") {
    try {
      obj = JSON.parse(body);
    } catch {
      return null;
    }
  }
  const v = obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : null;
  return typeof v === "string" && v.length > 0 && v.length < 100 ? v : null;
}

export function createHandler(deps: CtraderDeps, rateLog: Map<string, number[]> = new Map()) {
  const now = deps.now ?? Date.now;

  return async function handler(req: VercelStyleRequest, res: VercelStyleResponse) {
    res.setHeader("cache-control", "no-store");
    if (req.method !== "POST") {
      res.status(405).json({ error: "Alleen POST" });
      return;
    }
    const authHeader = req.headers["authorization"];
    const bearer =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!bearer) {
      res.status(401).json({ error: "Geen geldige Authorization-header" });
      return;
    }
    const action = typeof req.query?.action === "string" ? req.query.action : null;

    try {
      const user = await deps.getUser(bearer);
      if (!user) {
        res.status(401).json({ error: "Sessie ongeldig of verlopen" });
        return;
      }
      if (!user.beta) {
        res.status(403).json({ error: "Nog niet beschikbaar voor dit account" });
        return;
      }

      if (action === "start") {
        const state = signState({ userId: user.id, exp: now() + STATE_TTL_MS }, deps.secret);
        res.status(200).json({ url: deps.authorizeUrl(state) });
        return;
      }

      if (action === "disconnect") {
        const connectionId = bodyField(req.body, "connectionId");
        if (!connectionId) {
          res.status(400).json({ error: "connectionId ontbreekt" });
          return;
        }
        const ok = await deps.deleteConnection(user.id, connectionId);
        res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: "Koppeling niet gevonden" });
        return;
      }

      if (action === "sync") {
        const accountId = bodyField(req.body, "accountId");
        if (!accountId) {
          res.status(400).json({ error: "accountId ontbreekt" });
          return;
        }
        const windowStart = now() - SYNC_RATE_WINDOW_MS;
        const recent = (rateLog.get(user.id) ?? []).filter((t) => t > windowStart);
        if (recent.length >= SYNC_RATE_MAX) {
          rateLog.set(user.id, recent);
          res.status(429).json({ error: "Te veel sync-verzoeken — probeer het zo opnieuw" });
          return;
        }
        rateLog.set(user.id, [...recent, now()]);

        const account = await deps.getAccount(user.id, accountId);
        if (!account || !account.enabled) {
          res.status(404).json({ error: "Account niet gevonden of niet actief" });
          return;
        }
        const conn = await deps.getConnection(user.id, account.connection_id);
        if (!conn) {
          res.status(404).json({ error: "Koppeling niet gevonden" });
          return;
        }

        let accessToken = decryptToken(conn.access_token_enc, deps.secret);
        if (Date.parse(conn.token_expires_at) - now() < REFRESH_MARGIN_MS) {
          const fresh = await deps.refresh(decryptToken(conn.refresh_token_enc, deps.secret));
          await deps.saveTokens(conn.id, {
            access_token_enc: encryptToken(fresh.accessToken, deps.secret),
            refresh_token_enc: encryptToken(fresh.refreshToken, deps.secret),
            token_expires_at: new Date(fresh.expiresAt).toISOString(),
          });
          accessToken = fresh.accessToken;
        }

        const fromMs = Date.parse(account.synced_until);
        const result = await deps.fetchPositions(
          { ctidTraderAccountId: String(account.external_account_id), isLive: account.is_live, accessToken },
          Number.isFinite(fromMs) ? fromMs : now() - 30 * 24 * 60 * 60 * 1000
        );
        await deps.markSynced(account.id);
        res.status(200).json(result);
        return;
      }

      res.status(400).json({ error: "Onbekende action" });
    } catch (err) {
      // Generiek naar de client; details alleen server-side.
      console.error("ctrader:", err instanceof Error ? err.message : err);
      res.status(502).json({ error: "cTrader niet bereikbaar — probeer het later opnieuw" });
    }
  };
}

function buildRealDeps(): CtraderDeps {
  const { cfg, secret, admin } = readAppConfig();
  return {
    secret,
    async getUser(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      if (error || !data.user) return null;
      const { data: profile } = await admin
        .from("profiles")
        .select("beta_features, role")
        .eq("id", data.user.id)
        .maybeSingle();
      return { id: data.user.id, beta: profile?.beta_features === true || profile?.role === "admin" };
    },
    async getAccount(userId, accountId) {
      const { data, error } = await admin
        .from("broker_accounts")
        .select("id, connection_id, external_account_id, is_live, enabled, synced_until")
        .eq("id", accountId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`broker_accounts: ${error.message}`);
      return data;
    },
    async getConnection(userId, connectionId) {
      const { data, error } = await admin
        .from("broker_connections")
        .select("id, access_token_enc, refresh_token_enc, token_expires_at")
        .eq("id", connectionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`broker_connections: ${error.message}`);
      return data;
    },
    async saveTokens(connectionId, tokens) {
      const { error } = await admin.from("broker_connections").update(tokens).eq("id", connectionId);
      if (error) throw new Error(`broker_connections update: ${error.message}`);
    },
    async markSynced(accountId) {
      await admin.from("broker_accounts").update({ last_synced_at: new Date().toISOString() }).eq("id", accountId);
    },
    async deleteConnection(userId, connectionId) {
      const { data, error } = await admin
        .from("broker_connections")
        .delete()
        .eq("id", connectionId)
        .eq("user_id", userId)
        .select("id");
      if (error) throw new Error(`broker_connections delete: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },
    refresh: (rt) => refreshTokens(cfg, rt),
    fetchPositions: (account, fromMs) => fetchClosedPositions(cfg, account, fromMs),
    authorizeUrl: (state) => authorizeUrl(cfg, state),
  };
}

let realHandler: ReturnType<typeof createHandler> | null = null;

export default async function handler(req: VercelStyleRequest, res: VercelStyleResponse) {
  try {
    if (!realHandler) realHandler = createHandler(buildRealDeps());
  } catch (err) {
    console.error("ctrader (config):", err instanceof Error ? err.message : err);
    res.setHeader("cache-control", "no-store");
    res.status(500).json({ error: "Server niet geconfigureerd" });
    return;
  }
  return realHandler(req, res);
}
