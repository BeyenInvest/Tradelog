import { describe, expect, it, vi } from "vitest";
import type { ExtensionDb, JournalSchema, ProfileInfo, SessionInfo } from "./db";
import { logTradeFromChart, updateLoggedTradeByRef, type LogTradeRequest } from "./tradeFlow";

const SESSION: SessionInfo = { userId: "u1", email: "beyenchesney@outlook.com", expiresAt: null };
const PROFILE: ProfileInfo = { methodologyId: "m-1", timezone: "Europe/Brussels" };

const LEGACY_JOURNAL: JournalSchema = {
  id: "m-1",
  naam: "WPM",
  assetClass: "forex",
  trackExit: false,
  screenshotLabels: null,
  screenshotTimeframes: null,
  fields: [
    {
      id: "f-fase",
      fieldKey: "fase",
      label: "Fase",
      labelKey: null,
      fieldType: "enum",
      options: ["Fase 2", "Fase 3"],
      required: true,
      isComputed: false,
      groupLabel: null,
      sortOrder: 0,
      showWhenFieldId: null,
      showWhenValues: null,
    },
  ],
};

function makeDb(overrides: Partial<ExtensionDb> = {}): ExtensionDb {
  return {
    verifyLinkToken: vi.fn(),
    signOutLocal: vi.fn(),
    getSessionInfo: vi.fn(async () => SESSION),
    refreshSession: vi.fn(async () => ({})),
    getProfile: vi.fn(async () => PROFILE),
    getJournalSchema: vi.fn(async () => LEGACY_JOURNAL),
    listJournals: vi.fn(async () => []),
    listBacktestProjects: vi.fn(async () => []),
    insertTrade: vi.fn(async () => ({ ok: true as const, tradeId: "t-1", duplicate: false })),
    listOpenTrades: vi.fn(async () => []),
    updateTrade: vi.fn(async () => ({ ok: true as const, tradeId: "t-1" })),
    ...overrides,
  } as ExtensionDb;
}

function req(overrides: Partial<LogTradeRequest> = {}): LogTradeRequest {
  return {
    symbolRaw: "OANDA:AUDJPY",
    target: { type: "live" },
    mode: { kind: "live-open" },
    direction: "Long",
    prices: { entry: 110.33, stop: 109.83, target: 111.33 },
    entryTimeUtcSec: 1789448400,
    riskPct: 1,
    custom: {},
    clientUuid: "c-uuid-1",
    ...overrides,
  };
}

describe("logTradeFromChart — methodology-antwoorden via custom", () => {
  it("stuurt fase/cc/kenmerk mee in de custom-bag (geen aparte kolommen meer)", async () => {
    const insertTrade = vi.fn(async (_payload: Record<string, unknown>) => ({ ok: true as const, tradeId: "t-1", duplicate: false }));
    const db = makeDb({ insertTrade });
    const result = await logTradeFromChart(
      db,
      req({ custom: { fase: "Fase 3", cc: "15", entry: "Decel", fase3_engulfing_candle: true } })
    );
    expect(result.ok).toBe(true);
    const payload = insertTrade.mock.calls[0]?.[0];
    // fase/cc/… zijn sinds de fase-retirement gewone custom-velden.
    expect(payload.fase).toBeUndefined();
    expect(payload.custom).toEqual({ fase: "Fase 3", cc: "15", entry: "Decel", fase3_engulfing_candle: true });
  });
});

describe("logTradeFromChart", () => {
  it("bouwt en insert een live-open trade met import_ref", async () => {
    const db = makeDb();
    const result = await logTradeFromChart(db, req());
    expect(result).toEqual({ ok: true, tradeId: "t-1", duplicate: false });
    const payload = (db.insertTrade as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.import_ref).toBe("tv-ext:c-uuid-1");
    expect(payload.pair).toBe("AUDJPY");
    expect(payload.is_open).toBe(true);
    expect(payload.entry_price).toBe(110.33);
    expect(payload.tijd_open).toBe("07:00"); // 05:00 UTC → Brussel
  });

  it("een backtest-trade draagt het actieve journal én het project (M2)", async () => {
    const db = makeDb();
    await logTradeFromChart(db, req({
      target: { type: "project", projectId: "p-9" },
      mode: { kind: "post-hoc", outcome: "Win", resultaatPct: 2 },
    }));
    const payload = (db.insertTrade as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.backtest_project_id).toBe("p-9");
    expect(payload.methodology_id).toBe("m-1"); // zelfde gedrag als de web-form
  });

  it("een Win/Loss/BE-log krijgt de sluitdatum van de laatste bar mee (profiel-tz)", async () => {
    const db = makeDb();
    await logTradeFromChart(db, req({
      mode: { kind: "post-hoc", outcome: "Win", resultaatPct: 2 },
      // Twee dagen na de entry-bar, 21:30 UTC = 23:30 Brussel → 17 sep.
      closeTimeUtcSec: Date.UTC(2026, 8, 17, 21, 30) / 1000,
    }));
    const payload = (db.insertTrade as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.is_open).toBe(false);
    expect(payload.datum_sluiting).toBe("2026-09-17");
  });

  it("weigert zonder sessie / zonder profiel", async () => {
    expect(await logTradeFromChart(makeDb({ getSessionInfo: vi.fn(async () => null) }), req()))
      .toMatchObject({ ok: false, stage: "auth" });
    expect(await logTradeFromChart(makeDb({ getProfile: vi.fn(async () => null) }), req()))
      .toMatchObject({ ok: false, stage: "profile", error: "profile-unreadable" });
  });

  it("geeft build-degradaties door zonder insert", async () => {
    const db = makeDb();
    const result = await logTradeFromChart(db, req({ symbolRaw: "  " }));
    expect(result).toMatchObject({ ok: false, stage: "build", error: "symbol-unreadable" });
    const es = await logTradeFromChart(db, req({ symbolRaw: "CME_MINI:ES1!" }));
    expect(es).toMatchObject({ ok: false, stage: "build", error: "symbol-not-in-pairs" }); // forex-journal
    expect(db.insertTrade).not.toHaveBeenCalled();
  });

  it("een duplicate-insert is succes (idempotente retry, C6)", async () => {
    const db = makeDb({ insertTrade: vi.fn(async () => ({ ok: true as const, tradeId: null, duplicate: true })) });
    expect(await logTradeFromChart(db, req())).toEqual({ ok: true, tradeId: null, duplicate: true });
  });

  it("meldt een ontbrekende 0058-kolom expliciet", async () => {
    const db = makeDb({
      insertTrade: vi.fn(async () => ({ ok: false as const, error: "column …", code: "missing-column" as const })),
    });
    expect(await logTradeFromChart(db, req())).toMatchObject({ ok: false, stage: "insert", error: "missing-column" });
  });

  it("zet snapshot-paden in de vier vaste kolommen", async () => {
    const db = makeDb();
    await logTradeFromChart(db, req({ screenshots: { w: "u1/a.png", h4: "u1/b.png" } }));
    const payload = (db.insertTrade as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.w_screenshot).toBe("u1/a.png");
    expect(payload.h4_screenshot).toBe("u1/b.png");
    expect(payload.d_screenshot).toBeNull();
    expect(payload.h2_screenshot).toBeNull();
  });

  it("werkt de laatst gelogde trade bij via z'n import_ref (F5) — zelfde payload, geen insert", async () => {
    const db = makeDb();
    const result = await updateLoggedTradeByRef(db, req({ notes: "toch B-setup" }));
    expect(result).toEqual({ ok: true, tradeId: "t-1", duplicate: false });
    expect(db.insertTrade).not.toHaveBeenCalled();
    const [where, patch] = (db.updateTrade as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { importRef: string }, Record<string, unknown>,
    ];
    expect(where).toEqual({ importRef: "tv-ext:c-uuid-1" });
    expect(patch.notes).toBe("toch B-setup");
    expect(patch.pair).toBe("AUDJPY");
  });

  it("bijwerken van een intussen verdwenen trade meldt not-found; build-fouten stoppen vóór de update", async () => {
    const gone = makeDb({
      updateTrade: vi.fn(async () => ({ ok: false as const, error: "0 rijen", code: "not-found" as const })),
    });
    expect(await updateLoggedTradeByRef(gone, req()))
      .toMatchObject({ ok: false, stage: "update", error: "not-found" });

    const db = makeDb();
    expect(await updateLoggedTradeByRef(db, req({ symbolRaw: "  " })))
      .toMatchObject({ ok: false, stage: "build", error: "symbol-unreadable" });
    expect(db.updateTrade).not.toHaveBeenCalled();
  });

  it("niet-forex journal: vrij instrument, ES1! mag wel", async () => {
    const db = makeDb({
      getJournalSchema: vi.fn(async () => ({ ...LEGACY_JOURNAL, assetClass: "futures", fields: [] })),
    });
    const result = await logTradeFromChart(db, req({ symbolRaw: "CME_MINI:ES1!" }));
    expect(result.ok).toBe(true);
    const payload = (db.insertTrade as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.instrument).toBe("ES");
  });
});
