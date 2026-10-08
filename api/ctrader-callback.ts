// cTrader OAuth-callback (plan-ctrader-sync §3).
//
// GET /api/ctrader-callback?code=…&state=… — cTrader stuurt de browser hierheen
// na "Allow access". Geen Supabase-JWT (top-level navigatie): de HMAC-gesigneerde
// state uit api/ctrader.ts?action=start bewijst wie de koppeling startte.
// Wisselt de code in, slaat de tokens versleuteld op, registreert de accounts
// (standaard uit — de gebruiker kiest in Settings het doel-journal) en stuurt
// terug naar /settings?ctrader=connected|error.

import { readAppConfig } from "./_lib/ctrader/config.js";
import { encryptToken, verifyState } from "./_lib/ctrader/secrets.js";
import { exchangeCode, listAccounts, type CtraderAccountInfo, type TokenSet } from "./_lib/ctrader/sync.js";

interface VercelStyleRequest {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
}

interface VercelStyleResponse {
  status(code: number): VercelStyleResponse;
  setHeader(name: string, value: string): void;
  end(): void;
}

export interface CallbackDeps {
  secret: string;
  exchange(code: string): Promise<TokenSet>;
  listAccounts(accessToken: string): Promise<CtraderAccountInfo[]>;
  /** Slaat grant + accounts op; ruimt verweesde oude grants van dezelfde user op. */
  store(userId: string, tokens: { access_token_enc: string; refresh_token_enc: string; token_expires_at: string }, accounts: CtraderAccountInfo[]): Promise<void>;
  now?(): number;
}

function redirect(res: VercelStyleResponse, outcome: "connected" | "error" | "denied" | "noaccounts") {
  res.setHeader("cache-control", "no-store");
  res.setHeader("location", `/settings?ctrader=${outcome}`);
  res.status(302).end();
}

export function createCallbackHandler(deps: CallbackDeps) {
  return async function handler(req: VercelStyleRequest, res: VercelStyleResponse) {
    const q = (k: string) => (typeof req.query?.[k] === "string" ? req.query[k] : null);
    if (req.method !== "GET") {
      res.status(405).end();
      return;
    }
    const state = q("state") ? verifyState(q("state")!, deps.secret, (deps.now ?? Date.now)()) : null;
    if (!state) {
      redirect(res, "error");
      return;
    }
    const code = q("code");
    if (!code) {
      // Gebruiker klikte "Deny" (cTrader stuurt dan een error-parameter).
      redirect(res, "denied");
      return;
    }
    try {
      const tokens = await deps.exchange(code);
      const accounts = await deps.listAccounts(tokens.accessToken);
      if (accounts.length === 0) {
        redirect(res, "noaccounts");
        return;
      }
      await deps.store(
        state.userId,
        {
          access_token_enc: encryptToken(tokens.accessToken, deps.secret),
          refresh_token_enc: encryptToken(tokens.refreshToken, deps.secret),
          token_expires_at: new Date(tokens.expiresAt).toISOString(),
        },
        accounts
      );
      redirect(res, "connected");
    } catch (err) {
      console.error("ctrader-callback:", err instanceof Error ? err.message : err);
      redirect(res, "error");
    }
  };
}

function buildRealDeps(): CallbackDeps {
  const { cfg, secret, admin } = readAppConfig();
  return {
    secret,
    exchange: (code) => exchangeCode(cfg, code),
    listAccounts: (accessToken) => listAccounts(cfg, accessToken),
    async store(userId, tokens, accounts) {
      const { data: conn, error } = await admin
        .from("broker_connections")
        .insert({ user_id: userId, provider: "ctrader", ...tokens })
        .select("id")
        .single();
      if (error || !conn) throw new Error(`broker_connections insert: ${error?.message}`);

      // Upsert per account: een her-koppeling hangt bestaande accounts aan de
      // nieuwe grant en laat journal/aan-uit/cursor ongemoeid.
      const rows = accounts.map((a) => ({
        user_id: userId,
        connection_id: conn.id,
        provider: "ctrader",
        external_account_id: a.ctidTraderAccountId,
        is_live: a.isLive,
        account_login: a.traderLogin,
        broker_name: a.brokerName,
      }));
      const { error: upsertError } = await admin
        .from("broker_accounts")
        .upsert(rows, { onConflict: "user_id,provider,external_account_id" });
      if (upsertError) throw new Error(`broker_accounts upsert: ${upsertError.message}`);

      // Oude grants zonder accounts zijn wees — weg ermee (tokens niet laten slingeren).
      const { data: conns } = await admin.from("broker_connections").select("id").eq("user_id", userId).neq("id", conn.id);
      for (const c of conns ?? []) {
        const { count } = await admin
          .from("broker_accounts")
          .select("id", { count: "exact", head: true })
          .eq("connection_id", c.id);
        if (!count) await admin.from("broker_connections").delete().eq("id", c.id);
      }
    },
  };
}

let realHandler: ReturnType<typeof createCallbackHandler> | null = null;

export default async function handler(req: VercelStyleRequest, res: VercelStyleResponse) {
  try {
    if (!realHandler) realHandler = createCallbackHandler(buildRealDeps());
  } catch (err) {
    console.error("ctrader-callback (config):", err instanceof Error ? err.message : err);
    redirect(res, "error");
    return;
  }
  return realHandler(req, res);
}
