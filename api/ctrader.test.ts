import { describe, expect, it, vi } from "vitest";
import { createHandler, type CtraderDeps } from "./ctrader";
import { createCallbackHandler, type CallbackDeps } from "./ctrader-callback";
import { encryptToken, signState } from "./_lib/ctrader/secrets";

const SECRET = "s".repeat(40);
const NOW = Date.parse("2026-10-08T12:00:00Z");

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
    end() {},
  };
  return res;
}

function deps(overrides: Partial<CtraderDeps> = {}): CtraderDeps {
  return {
    secret: SECRET,
    now: () => NOW,
    getUser: async (jwt) => (jwt === "good" ? { id: "u1", beta: true } : jwt === "nobeta" ? { id: "u2", beta: false } : null),
    getAccount: async (userId, accountId) =>
      userId === "u1" && accountId === "a1"
        ? { id: "a1", connection_id: "c1", external_account_id: "555", is_live: false, enabled: true, synced_until: "2026-10-01T00:00:00Z" }
        : null,
    getConnection: async (userId, id) =>
      userId === "u1" && id === "c1"
        ? {
            id: "c1",
            access_token_enc: encryptToken("old-access", SECRET),
            refresh_token_enc: encryptToken("refresh-1", SECRET),
            token_expires_at: new Date(NOW + 20 * 86400000).toISOString(),
          }
        : null,
    saveTokens: vi.fn(async () => {}),
    markSynced: vi.fn(async () => {}),
    deleteConnection: async (userId, id) => userId === "u1" && id === "c1",
    refresh: vi.fn(async () => ({ accessToken: "new-access", refreshToken: "refresh-2", expiresAt: NOW + 30 * 86400000 })),
    fetchPositions: vi.fn(async () => ({ positions: [], stillOpen: 0, fetchedUntil: NOW, hasMore: false })),
    authorizeUrl: (state) => `https://id.ctrader.com/x?state=${state}`,
    ...overrides,
  };
}

const post = (action: string, jwt: string | null, body?: object) => ({
  method: "POST",
  query: { action },
  headers: jwt ? { authorization: `Bearer ${jwt}` } : {},
  body,
});

describe("api/ctrader", () => {
  it("weigert zonder JWT, met ongeldige JWT en zonder beta", async () => {
    const h = createHandler(deps());
    for (const [jwt, code] of [[null, 401], ["bad", 401], ["nobeta", 403]] as const) {
      const res = mockRes();
      await h(post("start", jwt), res);
      expect(res.statusCode).toBe(code);
    }
  });

  it("start geeft een OAuth-URL met gesigneerde state", async () => {
    const res = mockRes();
    await createHandler(deps())(post("start", "good"), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { url: string }).url).toMatch(/^https:\/\/id\.ctrader\.com\/x\?state=.+\..+/);
  });

  it("sync haalt op vanaf de cursor met het ontsleutelde token", async () => {
    const d = deps();
    const res = mockRes();
    await createHandler(d)(post("sync", "good", { accountId: "a1" }), res);
    expect(res.statusCode).toBe(200);
    expect(d.fetchPositions).toHaveBeenCalledWith(
      { ctidTraderAccountId: "555", isLive: false, accessToken: "old-access" },
      Date.parse("2026-10-01T00:00:00Z")
    );
    expect(d.refresh).not.toHaveBeenCalled();
    expect(d.markSynced).toHaveBeenCalledWith("a1");
  });

  it("ververst een bijna-verlopen token en bewaart het versleuteld", async () => {
    const base = deps();
    const conn = (await base.getConnection("u1", "c1"))!;
    const d = deps({ getConnection: async () => ({ ...conn, token_expires_at: new Date(NOW + 3600_000).toISOString() }) });
    const res = mockRes();
    await createHandler(d)(post("sync", "good", { accountId: "a1" }), res);
    expect(d.refresh).toHaveBeenCalledWith("refresh-1");
    const saved = vi.mocked(d.saveTokens).mock.calls[0][1];
    expect(saved.access_token_enc).not.toContain("new-access");
    expect(vi.mocked(d.fetchPositions).mock.calls[0][0].accessToken).toBe("new-access");
  });

  it("andermans account → 404, nooit een fetch", async () => {
    const d = deps();
    const res = mockRes();
    await createHandler(d)(post("sync", "good", { accountId: "someone-else" }), res);
    expect(res.statusCode).toBe(404);
    expect(d.fetchPositions).not.toHaveBeenCalled();
  });

  it("rate-limit per gebruiker", async () => {
    const h = createHandler(deps());
    let last = 0;
    for (let i = 0; i < 13; i++) {
      const res = mockRes();
      await h(post("sync", "good", { accountId: "a1" }), res);
      last = res.statusCode;
    }
    expect(last).toBe(429);
  });

  it("cTrader-fout → generieke 502 zonder details", async () => {
    const res = mockRes();
    await createHandler(deps({ fetchPositions: async () => { throw new Error("CH_ACCESS_TOKEN_INVALID secret stuff"); } }))(
      post("sync", "good", { accountId: "a1" }),
      res
    );
    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});

describe("api/ctrader-callback", () => {
  function cbDeps(overrides: Partial<CallbackDeps> = {}): CallbackDeps {
    return {
      secret: SECRET,
      now: () => NOW,
      exchange: async () => ({ accessToken: "acc", refreshToken: "ref", expiresAt: NOW + 1000 }),
      listAccounts: async () => [{ ctidTraderAccountId: "555", isLive: false, traderLogin: "123", brokerName: "Demo" }],
      store: vi.fn(async () => {}),
      ...overrides,
    };
  }
  const get = (query: Record<string, string>) => ({ method: "GET", query });

  it("geldige state + code → tokens versleuteld opgeslagen, redirect connected", async () => {
    const d = cbDeps();
    const res = mockRes();
    await createCallbackHandler(d)(get({ code: "c", state: signState({ userId: "u1", exp: NOW + 60_000 }, SECRET) }), res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/settings?ctrader=connected");
    const [userId, tokens] = vi.mocked(d.store).mock.calls[0];
    expect(userId).toBe("u1");
    expect(tokens.access_token_enc).not.toContain("acc");
  });

  it("vervalste of verlopen state → error, niets opgeslagen", async () => {
    for (const state of ["garbage", signState({ userId: "u1", exp: NOW - 1 }, SECRET), signState({ userId: "u1", exp: NOW + 1000 }, "t".repeat(40))]) {
      const d = cbDeps();
      const res = mockRes();
      await createCallbackHandler(d)(get({ code: "c", state }), res);
      expect(res.headers.location).toBe("/settings?ctrader=error");
      expect(d.store).not.toHaveBeenCalled();
    }
  });

  it("geweigerd in cTrader → denied", async () => {
    const res = mockRes();
    await createCallbackHandler(cbDeps())(get({ error: "access_denied", state: signState({ userId: "u1", exp: NOW + 60_000 }, SECRET) }), res);
    expect(res.headers.location).toBe("/settings?ctrader=denied");
  });
});
