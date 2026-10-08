import { describe, expect, it } from "vitest";
import { buildClosedPositions, positionsMissingOpen, type RawDeal } from "./positions";
import { decryptToken, encryptToken, signState, verifyState } from "./secrets";
import { openSession, PT, type WsFactory } from "./protocol";

const SECRET = "x".repeat(40);
const symbols = new Map([
  ["1", "EURUSD"],
  ["41", "XAUUSD"],
]);

// Bedragen in centen (moneyDigits 2).
const open = (positionId: number, ts: number, side: 1 | 2, symbolId = 1): RawDeal => ({
  dealId: `${positionId}o`,
  positionId,
  symbolId,
  executionTimestamp: ts,
  tradeSide: side,
  dealStatus: 2,
});
const close = (positionId: number, ts: number, side: 1 | 2, gross: number, balance: number, extra: Partial<NonNullable<RawDeal["closePositionDetail"]>> = {}, symbolId = 1): RawDeal => ({
  dealId: `${positionId}c${ts}`,
  positionId,
  symbolId,
  executionTimestamp: ts,
  tradeSide: side,
  dealStatus: 2,
  closePositionDetail: { grossProfit: gross, swap: 0, commission: 0, balance, moneyDigits: 2, ...extra },
});

describe("buildClosedPositions", () => {
  it("maakt één trade per positie met netto P&L en exact %", () => {
    // Long EURUSD: +100 bruto, −7 commissie, −3 swap → netto 90 op saldo 10.000.
    const deals = [open(7, 1000, 1), close(7, 5000, 2, 10000, 1009000, { commission: -700, swap: -300 })];
    const { positions } = buildClosedPositions(deals, symbols, new Set());
    expect(positions).toEqual([
      { positionId: "7", symbol: "EURUSD", side: "buy", openTs: 1000, closeTs: 5000, netPnl: 90, balanceAfter: 10090, returnPct: 0.9 },
    ]);
  });

  it("telt gedeeltelijke sluitingen op, % t.o.v. het saldo vóór de eerste sluiting", () => {
    const deals = [
      open(8, 1000, 2),
      close(8, 2000, 1, 5000, 1005000), // +50 → saldo 10.050
      close(8, 3000, 1, 5000, 1010000), // +50 → saldo 10.100
    ];
    const [p] = buildClosedPositions(deals, symbols, new Set()).positions;
    expect(p.side).toBe("sell");
    expect(p.netPnl).toBe(100);
    expect(p.returnPct).toBe(1);
    expect(p.closeTs).toBe(3000);
    expect(p.balanceAfter).toBe(10100);
  });

  it("slaat nog-open posities over en telt ze", () => {
    const deals = [open(9, 1000, 1), close(9, 2000, 2, 1000, 1001000)];
    const res = buildClosedPositions(deals, symbols, new Set(["9"]));
    expect(res.positions).toEqual([]);
    expect(res.stillOpen).toBe(1);
  });

  it("negeert afgewezen deals en dubbele deals (chunk-overlap)", () => {
    const c = close(10, 2000, 2, -2000, 998000);
    const deals = [open(10, 1000, 1), c, c, { ...close(10, 2500, 2, 99999, 1), dealStatus: 4, dealId: "rej" }];
    const [p] = buildClosedPositions(deals, symbols, new Set()).positions;
    expect(p.netPnl).toBe(-20);
    expect(p.returnPct).toBe(-0.2);
  });

  it("leidt de richting af uit de sluit-deal als de opening ontbreekt", () => {
    const [p] = buildClosedPositions([close(11, 2000, 1, 100, 1000100, {}, 41)], symbols, new Set()).positions;
    expect(p.side).toBe("sell");
    expect(p.symbol).toBe("XAUUSD");
    expect(p.openTs).toBe(2000);
  });

  it("accepteert int64 als string en enums als naam", () => {
    const deals: RawDeal[] = [
      { ...open(12, 1000, 1), executionTimestamp: "1000", tradeSide: "BUY", dealStatus: "FILLED", positionId: "12" },
      { ...close(12, 2000, 2, 100, 1000100), executionTimestamp: "2000", tradeSide: "SELL", positionId: "12" },
    ];
    const [p] = buildClosedPositions(deals, symbols, new Set()).positions;
    expect(p.side).toBe("buy");
    expect(p.netPnl).toBe(1);
  });

  it("positionsMissingOpen vindt sluitingen zonder opening", () => {
    expect(positionsMissingOpen([open(1, 1, 1), close(1, 2, 2, 0, 0), close(2, 3, 2, 0, 0)])).toEqual(["2"]);
  });
});

describe("secrets", () => {
  it("token round-trip, en een andere sleutel faalt", () => {
    const blob = encryptToken("tok-123", SECRET);
    expect(blob).not.toContain("tok-123");
    expect(decryptToken(blob, SECRET)).toBe("tok-123");
    expect(() => decryptToken(blob, "y".repeat(40))).toThrow();
  });

  it("state: geldig, vervalst en verlopen", () => {
    const token = signState({ userId: "u1", exp: 10_000 }, SECRET);
    expect(verifyState(token, SECRET, 5_000)).toEqual({ userId: "u1", exp: 10_000 });
    expect(verifyState(token, SECRET, 20_000)).toBeNull();
    expect(verifyState(token, "y".repeat(40), 5_000)).toBeNull();
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "attacker", e: 10_000 })).toString("base64url");
    expect(verifyState(`${forged}.${sig}`, SECRET, 5_000)).toBeNull();
    expect(verifyState(body, SECRET, 5_000)).toBeNull();
  });
});

describe("protocol", () => {
  function fakeWs(reply: (msg: { clientMsgId: string; payloadType: number; payload: Record<string, unknown> }) => object): WsFactory {
    return () => {
      const listeners: Record<string, Array<(ev: { data?: unknown }) => void>> = {};
      const ws = {
        send(data: string) {
          const msg = JSON.parse(data);
          if (msg.payloadType === PT.HEARTBEAT) return;
          queueMicrotask(() => listeners.message?.forEach((cb) => cb({ data: JSON.stringify({ clientMsgId: msg.clientMsgId, ...reply(msg) }) })));
        },
        close() {},
        addEventListener(type: string, cb: (ev: { data?: unknown }) => void) {
          (listeners[type] ??= []).push(cb);
        },
      };
      queueMicrotask(() => listeners.open?.forEach((cb) => cb({})));
      return ws;
    };
  }

  it("koppelt responses op clientMsgId en zet ProtoOAErrorRes om in een fout", async () => {
    const session = await openSession(
      false,
      fakeWs((msg) =>
        msg.payloadType === PT.APPLICATION_AUTH_REQ
          ? { payloadType: PT.APPLICATION_AUTH_RES, payload: { ok: 1 } }
          : { payloadType: PT.OA_ERROR_RES, payload: { errorCode: "CH_ACCESS_TOKEN_INVALID", description: "bad" } }
      )
    );
    await expect(session.request(PT.APPLICATION_AUTH_REQ, {})).resolves.toEqual({ ok: 1 });
    await expect(session.request(PT.ACCOUNT_AUTH_REQ, {})).rejects.toThrow("CH_ACCESS_TOKEN_INVALID");
    session.close();
  });
});
