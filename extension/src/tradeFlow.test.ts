import { describe, expect, it, vi } from "vitest";
import type { ExtensionDb, JournalSchema, ProfileInfo, SessionInfo } from "./db";
import { firstFaseOf, logTradeFromChart, type LogTradeRequest } from "./tradeFlow";

const SESSION: SessionInfo = { userId: "u1", email: "beyenchesney@outlook.com", expiresAt: null };
const PROFILE: ProfileInfo = { beta: true, methodologyId: "m-1", timezone: "Europe/Brussels" };

const LEGACY_JOURNAL: JournalSchema = {
  id: "m-1",
  naam: "WPM",
  assetClass: "forex",
  trackExit: false,
  fields: [
    {
      fieldKey: "fase",
      label: "Fase",
      labelKey: null,
      fieldType: "enum",
      options: ["Fase 2", "Fase 3"],
      required: true,
      isComputed: false,
      groupLabel: null,
      sortOrder: 0,
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

describe("firstFaseOf", () => {
  it("pakt de eerste fase-optie van een legacy journal", () => {
    expect(firstFaseOf(LEGACY_JOURNAL)).toBe("Fase 2");
  });

  it("valt terug op de quick-log-default zonder fase-veld", () => {
    expect(firstFaseOf({ ...LEGACY_JOURNAL, fields: [] })).toBe("Fase 1");
    expect(firstFaseOf(null)).toBe("Fase 1");
  });
});

describe("logTradeFromChart", () => {
  it("bouwt en insert een live-open trade met journal-fase en import_ref", async () => {
    const db = makeDb();
    const result = await logTradeFromChart(db, req());
    expect(result).toEqual({ ok: true, tradeId: "t-1", duplicate: false });
    const payload = (db.insertTrade as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.fase).toBe("Fase 2"); // uit het journal, niet de blinde default
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

  it("weigert zonder sessie / buiten de beta", async () => {
    expect(await logTradeFromChart(makeDb({ getSessionInfo: vi.fn(async () => null) }), req()))
      .toMatchObject({ ok: false, stage: "auth" });
    expect(await logTradeFromChart(makeDb({ getProfile: vi.fn(async () => ({ ...PROFILE, beta: false })) }), req()))
      .toMatchObject({ ok: false, stage: "profile", error: "not-beta" });
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

  it("niet-forex journal: vrij instrument, ES1! mag wel", async () => {
    const db = makeDb({
      getJournalSchema: vi.fn(async () => ({ ...LEGACY_JOURNAL, assetClass: "futures", fields: [] })),
    });
    const result = await logTradeFromChart(db, req({ symbolRaw: "CME_MINI:ES1!" }));
    expect(result.ok).toBe(true);
    const payload = (db.insertTrade as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.instrument).toBe("ES");
    expect(payload.fase).toBe("Fase 1");
  });
});
