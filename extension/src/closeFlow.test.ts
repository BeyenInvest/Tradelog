import { describe, expect, it, vi } from "vitest";
import {
  closeTradeFromChart, listOpenTradesForSymbol, previewClose, tradeMatchesSymbol,
  type CloseTradeRequest,
} from "./closeFlow";
import type { ExtensionDb, OpenTradeInfo, ProfileInfo, SessionInfo } from "./db";

const SESSION: SessionInfo = { userId: "u1", email: "beyenchesney@outlook.com", expiresAt: null };
const PROFILE: ProfileInfo = { beta: true, methodologyId: "m-1", timezone: "Europe/Brussels" };

const OPEN_TRADE: OpenTradeInfo = {
  id: "t-1",
  datumOpen: "2026-09-15",
  tijdOpen: "07:00",
  pair: "AUDJPY",
  instrument: "AUDJPY",
  direction: "Long",
  entryPrice: 110.33,
  stopPrice: 109.83,
  targetPrice: 111.33,
  riskPct: 1,
  importRef: "tv-ext:abc",
};

function makeDb(overrides: Partial<ExtensionDb> = {}): ExtensionDb {
  return {
    verifyLinkToken: vi.fn(),
    signOutLocal: vi.fn(),
    getSessionInfo: vi.fn(async () => SESSION),
    refreshSession: vi.fn(async () => ({})),
    getProfile: vi.fn(async () => PROFILE),
    getJournalSchema: vi.fn(async () => null),
    listJournals: vi.fn(async () => []),
    listBacktestProjects: vi.fn(async () => []),
    insertTrade: vi.fn(async () => ({ ok: true as const, tradeId: "t-1", duplicate: false })),
    listOpenTrades: vi.fn(async () => [OPEN_TRADE]),
    updateTrade: vi.fn(async () => ({ ok: true as const, tradeId: "t-1" })),
    ...overrides,
  } as ExtensionDb;
}

function closeReq(overrides: Partial<CloseTradeRequest> = {}): CloseTradeRequest {
  return {
    tradeId: "t-1",
    datumOpen: "2026-09-15",
    result: { kind: "exit-price", direction: "Long", entry: 110.33, stop: 109.83, exit: 111.33, riskPct: 1 },
    // 2026-09-17T21:00Z — bar-tijd van het sluitmoment (S1: bars().last()[0]).
    closeTimeUtcSec: 1789678800,
    ...overrides,
  };
}

function lastPatch(db: ExtensionDb): Record<string, unknown> {
  const call = (db.updateTrade as ReturnType<typeof vi.fn>).mock.calls.at(-1);
  return call?.[1] as Record<string, unknown>;
}

describe("tradeMatchesSymbol", () => {
  it("matcht op pair én op instrument, en anders niet", () => {
    expect(tradeMatchesSymbol(OPEN_TRADE, { pair: "AUDJPY", instrument: "AUDJPY" })).toBe(true);
    expect(tradeMatchesSymbol({ ...OPEN_TRADE, pair: "EURUSD", instrument: "ES" }, { pair: null, instrument: "ES" })).toBe(true);
    expect(tradeMatchesSymbol(OPEN_TRADE, { pair: "EURUSD", instrument: "EURUSD" })).toBe(false);
    expect(tradeMatchesSymbol({ ...OPEN_TRADE, instrument: null }, { pair: null, instrument: "AUDJPY" })).toBe(false);
  });
});

describe("listOpenTradesForSymbol", () => {
  it("filtert op het genormaliseerde chart-symbool en rekent plannedRR uit", async () => {
    const db = makeDb({
      listOpenTrades: vi.fn(async () => [
        OPEN_TRADE,
        { ...OPEN_TRADE, id: "t-2", pair: "EURUSD", instrument: "EURUSD" },
      ]),
    });
    const result = await listOpenTradesForSymbol(db, "OANDA:AUDJPY");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].id).toBe("t-1");
    expect(result.trades[0].plannedRR).toBe(2);
    expect(db.listOpenTrades).toHaveBeenCalledWith("m-1"); // journal-gefilterd
  });

  it("matcht een futures-symbool op het instrument (ES1! → ES)", async () => {
    const db = makeDb({
      listOpenTrades: vi.fn(async () => [
        { ...OPEN_TRADE, id: "t-3", pair: "EURUSD", instrument: "ES", entryPrice: null, stopPrice: null, targetPrice: null },
      ]),
    });
    const result = await listOpenTradesForSymbol(db, "CME_MINI:ES1!");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].plannedRR).toBeNull(); // geen prijzen — handmatig sluiten
  });

  it("weigert zonder sessie / buiten de beta / bij onleesbaar symbool", async () => {
    expect(await listOpenTradesForSymbol(makeDb({ getSessionInfo: vi.fn(async () => null) }), "OANDA:AUDJPY"))
      .toMatchObject({ ok: false, stage: "auth" });
    expect(await listOpenTradesForSymbol(makeDb({ getProfile: vi.fn(async () => ({ ...PROFILE, beta: false })) }), "OANDA:AUDJPY"))
      .toMatchObject({ ok: false, stage: "profile", error: "not-beta" });
    expect(await listOpenTradesForSymbol(makeDb(), "   "))
      .toMatchObject({ ok: false, stage: "build", error: "symbol-unreadable" });
  });
});

describe("closeTradeFromChart — exit-prijs-pad", () => {
  it("sluit met afgeleid resultaat, outcome en replay-veilige sluitdatum uit de bar-tijd", async () => {
    const db = makeDb();
    const result = await closeTradeFromChart(db, closeReq());
    expect(result).toMatchObject({ ok: true, outcome: "Win", resultaatPct: 2, datumSluiting: "2026-09-17" });
    const patch = lastPatch(db);
    expect(patch).toMatchObject({
      is_open: false,
      outcome: "Win",
      resultaat_pct: 2,
      exit_price: 111.33,
      datum_sluiting: "2026-09-17", // 21:00 UTC → 23:00 Brussel, zelfde dag
      trade_evaluation: null,
      mae_pct: null,
      mfe_pct: null,
    });
    expect((db.updateTrade as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({ id: "t-1" });
  });

  it("exit op de SL = -1R → Loss", async () => {
    const db = makeDb();
    const result = await closeTradeFromChart(db, closeReq({
      result: { kind: "exit-price", direction: "Long", entry: 110.33, stop: 109.83, exit: 109.83, riskPct: 1 },
    }));
    expect(result).toMatchObject({ ok: true, outcome: "Loss", resultaatPct: -1 });
  });

  it("weigert een SL aan de verkeerde kant — geen stil 'gecorrigeerde' R", async () => {
    const db = makeDb();
    const result = await closeTradeFromChart(db, closeReq({
      result: { kind: "exit-price", direction: "Short", entry: 110.33, stop: 109.83, exit: 111.33, riskPct: 1 },
    }));
    expect(result).toMatchObject({ ok: false, stage: "build", error: "direction-price-mismatch" });
    expect(db.updateTrade).not.toHaveBeenCalled();
  });

  it("weigert een onbruikbare exit-prijs (DB-check prices_positive)", async () => {
    const result = await closeTradeFromChart(makeDb(), closeReq({
      result: { kind: "exit-price", direction: "Long", entry: 110.33, stop: 109.83, exit: 0, riskPct: 1 },
    }));
    expect(result).toMatchObject({ ok: false, stage: "build", error: "exit-price-invalid" });
  });
});

describe("closeTradeFromChart — handmatig resultaat", () => {
  it("neemt het %-resultaat over zonder exit_price te zetten (prices_pair-check)", async () => {
    const db = makeDb();
    const result = await closeTradeFromChart(db, closeReq({ result: { kind: "manual", resultaatPct: -1.5 } }));
    expect(result).toMatchObject({ ok: true, outcome: "Loss", resultaatPct: -1.5 });
    expect("exit_price" in lastPatch(db)).toBe(false);
  });

  it("exact 0 en binnen de BE-epsilon = BE (gedeelde deriveOutcome)", async () => {
    const db = makeDb();
    expect(await closeTradeFromChart(db, closeReq({ result: { kind: "manual", resultaatPct: 0 } })))
      .toMatchObject({ ok: true, outcome: "BE" });
    expect(await closeTradeFromChart(db, closeReq({ result: { kind: "manual", resultaatPct: 0.004 } })))
      .toMatchObject({ ok: true, outcome: "BE" });
  });

  it("weigert een niet-numeriek resultaat", async () => {
    expect(await closeTradeFromChart(makeDb(), closeReq({ result: { kind: "manual", resultaatPct: Number.NaN } })))
      .toMatchObject({ ok: false, stage: "build", error: "result-invalid" });
  });
});

describe("closeTradeFromChart — evaluatie & excursies", () => {
  it("'Missed trade' is nooit kiesbaar (missed-trade-contract)", async () => {
    const db = makeDb();
    const result = await closeTradeFromChart(db, closeReq({ evaluation: "Missed trade" }));
    expect(result).toMatchObject({ ok: false, stage: "build", error: "missed-not-selectable" });
    expect(db.updateTrade).not.toHaveBeenCalled();
  });

  it("een graded evaluatie en MAE/MFE gaan mee in de patch (afgerond)", async () => {
    const db = makeDb();
    const result = await closeTradeFromChart(db, closeReq({ evaluation: "Good trade", maePct: 0.333, mfePct: 2.005 }));
    expect(result.ok).toBe(true);
    expect(lastPatch(db)).toMatchObject({ trade_evaluation: "Good trade", mae_pct: 0.33, mfe_pct: 2.01 });
  });

  it("weigert onbekende evaluaties en negatieve excursies", async () => {
    expect(await closeTradeFromChart(makeDb(), closeReq({ evaluation: "Great trade" })))
      .toMatchObject({ ok: false, error: "invalid-evaluation" });
    expect(await closeTradeFromChart(makeDb(), closeReq({ maePct: -1 })))
      .toMatchObject({ ok: false, error: "invalid-excursion" });
  });
});

describe("closeTradeFromChart — sluitdatum", () => {
  it("valt terug op de handmatige datum zonder bar-tijd; zonder allebei een fout (nooit Date.now)", async () => {
    const db = makeDb();
    const result = await closeTradeFromChart(db, closeReq({ closeTimeUtcSec: null, manualDate: "2026-09-16" }));
    expect(result).toMatchObject({ ok: true, datumSluiting: "2026-09-16" });
    expect(await closeTradeFromChart(db, closeReq({ closeTimeUtcSec: null, manualDate: null })))
      .toMatchObject({ ok: false, stage: "build", error: "no-close-time" });
  });

  it("weigert een sluitdatum vóór de opendatum (replay-vergissing)", async () => {
    const result = await closeTradeFromChart(makeDb(), closeReq({ closeTimeUtcSec: null, manualDate: "2026-09-10" }));
    expect(result).toMatchObject({ ok: false, stage: "build", error: "close-before-open" });
  });
});

describe("closeTradeFromChart — schrijffouten", () => {
  it("geeft constraint- en not-found-fouten van de update door", async () => {
    const constraint = makeDb({
      updateTrade: vi.fn(async () => ({ ok: false as const, error: "trades_open_result_chk", code: "constraint" as const })),
    });
    expect(await closeTradeFromChart(constraint, closeReq()))
      .toMatchObject({ ok: false, stage: "update", error: "constraint" });

    const missing = makeDb({
      updateTrade: vi.fn(async () => ({ ok: false as const, error: "0 rijen", code: "not-found" as const })),
    });
    expect(await closeTradeFromChart(missing, closeReq()))
      .toMatchObject({ ok: false, stage: "update", error: "not-found" });
  });
});

describe("previewClose", () => {
  it("levert R, % en outcome in één keer (S0-fixture: +2R bij 1% = Win)", () => {
    expect(previewClose("Long", 110.33, 109.83, 111.33, 1)).toEqual({ r: 2, resultaatPct: 2, outcome: "Win" });
    expect(previewClose("Long", 110.33, 109.83, 110.33, 1)).toEqual({ r: 0, resultaatPct: 0, outcome: "BE" });
  });

  it("null bij inconsistente invoer", () => {
    expect(previewClose("Short", 110.33, 109.83, 111.33, 1)).toBeNull();
  });
});
