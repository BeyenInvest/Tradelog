import { describe, expect, it, vi } from "vitest";
import { createHandler, type ExtensionLinkDeps } from "./extension-link";

interface JsonBody {
  error?: string;
  token_hash?: string;
}

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as JsonBody | undefined,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body as JsonBody;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
  };
  return res;
}

const USER = { id: "user-1", email: "beyenchesney@outlook.com" };

function makeDeps(overrides: Partial<ExtensionLinkDeps> = {}): ExtensionLinkDeps {
  return {
    getUserFromJwt: vi.fn(async (jwt: string) => (jwt === "valid-jwt" ? USER : null)),
    isBetaUser: vi.fn(async () => true),
    generateLinkTokenHash: vi.fn(async () => "hashed-token-123"),
    ...overrides,
  };
}

function postReq(auth?: string) {
  return { method: "POST", headers: auth ? { authorization: auth } : {} };
}

describe("extension-link handler", () => {
  it("weigert alles behalve POST", async () => {
    const handler = createHandler(makeDeps());
    const res = mockRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("401 zonder Authorization-header", async () => {
    const handler = createHandler(makeDeps());
    const res = mockRes();
    await handler(postReq(), res);
    expect(res.statusCode).toBe(401);
  });

  it("401 bij een niet-Bearer-header", async () => {
    const handler = createHandler(makeDeps());
    const res = mockRes();
    await handler(postReq("Basic abc"), res);
    expect(res.statusCode).toBe(401);
  });

  it("401 bij een ongeldige/verlopen JWT", async () => {
    const handler = createHandler(makeDeps());
    const res = mockRes();
    await handler(postReq("Bearer expired-jwt"), res);
    expect(res.statusCode).toBe(401);
  });

  it("403 voor een user buiten de beta", async () => {
    const deps = makeDeps({ isBetaUser: vi.fn(async () => false) });
    const handler = createHandler(deps);
    const res = mockRes();
    await handler(postReq("Bearer valid-jwt"), res);
    expect(res.statusCode).toBe(403);
    expect(deps.generateLinkTokenHash).not.toHaveBeenCalled();
  });

  it("geeft een token_hash aan een beta-user, op basis van de JWT-mail", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);
    const res = mockRes();
    await handler(postReq("Bearer valid-jwt"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ token_hash: "hashed-token-123" });
    // E-mail komt uit de geverifieerde JWT — nooit uit request-input.
    expect(deps.generateLinkTokenHash).toHaveBeenCalledWith(USER.email);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("429 na vijf verzoeken binnen het venster, en herstelt na het venster", async () => {
    let t = 1_000_000;
    const deps = makeDeps({ now: () => t });
    const handler = createHandler(deps);

    for (let i = 0; i < 5; i++) {
      const res = mockRes();
      await handler(postReq("Bearer valid-jwt"), res);
      expect(res.statusCode).toBe(200);
    }
    const blocked = mockRes();
    await handler(postReq("Bearer valid-jwt"), blocked);
    expect(blocked.statusCode).toBe(429);

    t += 10 * 60 * 1000 + 1;
    const afterWindow = mockRes();
    await handler(postReq("Bearer valid-jwt"), afterWindow);
    expect(afterWindow.statusCode).toBe(200);
  });

  it("rate-limit telt per user, niet globaal", async () => {
    const other = { id: "user-2", email: "ander@voorbeeld.be" };
    const deps = makeDeps({
      getUserFromJwt: vi.fn(async (jwt: string) =>
        jwt === "valid-jwt" ? USER : jwt === "other-jwt" ? other : null
      ),
    });
    const handler = createHandler(deps);
    for (let i = 0; i < 5; i++) {
      await handler(postReq("Bearer valid-jwt"), mockRes());
    }
    const res = mockRes();
    await handler(postReq("Bearer other-jwt"), res);
    expect(res.statusCode).toBe(200);
  });

  it("500 met generieke fout als generateLink faalt (geen details naar de client)", async () => {
    const deps = makeDeps({
      generateLinkTokenHash: vi.fn(async () => {
        throw new Error("interne supabase-fout met gevoelige details");
      }),
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createHandler(deps);
    const res = mockRes();
    await handler(postReq("Bearer valid-jwt"), res);
    expect(res.statusCode).toBe(500);
    expect(res.body?.error).not.toContain("supabase");
    spy.mockRestore();
  });
});
