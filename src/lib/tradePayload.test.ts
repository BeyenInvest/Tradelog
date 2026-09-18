import { describe, expect, it } from "vitest";
import type { NormalizedSymbol } from "./symbolNormalize";
import {
  buildTradePayload, type BuildTradeInput, pruneCustom, wallClockInTimezone,
} from "./tradePayload";

const AUDJPY: NormalizedSymbol = { pair: "AUDJPY", instrument: "AUDJPY", kind: "forex-pair", exchange: "OANDA" };
const ES: NormalizedSymbol = { pair: null, instrument: "ES", kind: "futures-continuous", exchange: "CME_MINI" };

// S0-fixture: bar-time 1789448400 (s) = 2026-09-15 05:00:00 UTC.
const BAR_UTC_MS = 1_789_448_400_000;

function baseInput(overrides: Partial<BuildTradeInput> = {}): BuildTradeInput {
  return {
    symbol: AUDJPY,
    isForexJournal: true,
    target: { type: "live", methodologyId: "m-1" },
    timezone: "Europe/Brussels",
    entryTimeUtcMs: BAR_UTC_MS,
    mode: { kind: "live-open" },
    direction: "Long",
    prices: { entry: 110.33, stop: 109.83, target: 111.33 },
    riskPct: 1,
    custom: {},
    clientUuid: "0f27b0e2-1111-2222-3333-444455556666",
    ...overrides,
  };
}

describe("pruneCustom", () => {
  it("houdt alleen beantwoorde string/number/boolean-waarden over", () => {
    expect(
      pruneCustom({ a: "x", b: 0, c: false, d: "", e: null, f: undefined, g: NaN, h: { nested: 1 } })
    ).toEqual({ a: "x", b: 0, c: false });
  });
});

describe("wallClockInTimezone", () => {
  it("converteert UTC naar de profiel-tijdzone (M4)", () => {
    // 05:00 UTC op 15 sep = 07:00 in Brussel (CEST, UTC+2).
    expect(wallClockInTimezone(BAR_UTC_MS, "Europe/Brussels")).toEqual({ date: "2026-09-15", time: "07:00" });
    // Zelfde instant in New York = 01:00 (EDT, UTC-4).
    expect(wallClockInTimezone(BAR_UTC_MS, "America/New_York")).toEqual({ date: "2026-09-15", time: "01:00" });
  });

  it("rolt over een datumgrens heen", () => {
    // 23:30 UTC → 01:30 volgende dag in Brussel.
    const lateUtc = Date.UTC(2026, 8, 15, 23, 30);
    expect(wallClockInTimezone(lateUtc, "Europe/Brussels")).toEqual({ date: "2026-09-16", time: "01:30" });
  });

  it("null bij kapotte tijdzone of timestamp", () => {
    expect(wallClockInTimezone(BAR_UTC_MS, "Not/AZone")).toBeNull();
    expect(wallClockInTimezone(NaN, "Europe/Brussels")).toBeNull();
  });
});

describe("buildTradePayload — live-open (M1)", () => {
  it("bouwt een geldige open trade met alle 0043-null-regels", () => {
    const result = buildTradePayload(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.payload;
    expect(p.is_open).toBe(true);
    expect(p.outcome).toBeNull();
    expect(p.resultaat_pct).toBeNull();
    expect(p.trade_evaluation).toBeNull();
    expect(p.mae_pct).toBeNull();
    expect(p.mfe_pct).toBeNull();
    expect(p.planned_rr).toBe(2); // S0-fixture
    // F2c (0058): prijzen landen in echte kolommen; exit is de F5-haak.
    expect(p.entry_price).toBe(110.33);
    expect(p.stop_price).toBe(109.83);
    expect(p.target_price).toBe(111.33);
    expect(p.exit_price).toBeNull();
    expect(p.pair).toBe("AUDJPY");
    expect(p.instrument).toBe("AUDJPY"); // forex spiegelt pair → instrument
    expect(p.datum_open).toBe("2026-09-15");
    expect(p.tijd_open).toBe("07:00"); // bar-time in profiel-tz, niet UTC
    expect(p.import_ref).toBe("tv-ext:0f27b0e2-1111-2222-3333-444455556666");
    expect(p.backtest_project_id).toBeNull();
    expect(p.methodology_id).toBe("m-1");
    // Geen legacy-kolommen meer (fase-retirement 0059): methodologie-antwoorden
    // leven in de custom-bag; hier leeg meegegeven.
    expect(p.custom).toEqual({});
  });

  it("gebruikt de bar-tijd, nooit 'nu' (replay, risico 10)", () => {
    const replayBar = Date.UTC(2025, 2, 31, 23, 0); // replay in het verleden
    const result = buildTradePayload(baseInput({ entryTimeUtcMs: replayBar }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.datum_open).toBe("2025-04-01"); // 23:00 UTC → +2 Brussel
  });
});

describe("buildTradePayload — post-hoc (backtest)", () => {
  it("bouwt een gesloten trade richting een project (M2)", () => {
    const result = buildTradePayload(
      baseInput({
        target: { type: "project", projectId: "proj-9", methodologyId: null },
        mode: { kind: "post-hoc", outcome: "Win", resultaatPct: 2.5 },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.is_open).toBe(false);
    expect(result.payload.outcome).toBe("Win");
    expect(result.payload.resultaat_pct).toBe(2.5);
    expect(result.payload.backtest_project_id).toBe("proj-9");
    expect(result.payload.methodology_id).toBeNull();
  });

  it("weigert een Loss met positieve % via de gedeelde tradeSchema", () => {
    const result = buildTradePayload(
      baseInput({ mode: { kind: "post-hoc", outcome: "Loss", resultaatPct: 1.2 } })
    );
    expect(result).toMatchObject({ ok: false, error: "schema-invalid" });
  });

  it("leidt de sluitdatum af uit de laatste bar (chart-'nu', profiel-tijdzone)", () => {
    // Entry 15 sep; laatste bar 17 sep 21:30 UTC = 23:30 Brussel → sluit 17 sep.
    const result = buildTradePayload(
      baseInput({
        mode: { kind: "post-hoc", outcome: "Win", resultaatPct: 2.5 },
        closeTimeUtcMs: Date.UTC(2026, 8, 17, 21, 30),
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.datum_sluiting).toBe("2026-09-17");
  });

  it("een expliciete mode-sluitdatum wint van de bar-tijd", () => {
    const result = buildTradePayload(
      baseInput({
        mode: { kind: "post-hoc", outcome: "Win", resultaatPct: 2.5, datumSluiting: "2026-09-16" },
        closeTimeUtcMs: Date.UTC(2026, 8, 17, 21, 30),
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.datum_sluiting).toBe("2026-09-16");
  });

  it("laat de sluitdatum leeg als de laatste bar vóór de entry ligt (verkeerde lezing)", () => {
    const result = buildTradePayload(
      baseInput({
        mode: { kind: "post-hoc", outcome: "Win", resultaatPct: 2.5 },
        closeTimeUtcMs: Date.UTC(2026, 8, 10, 12, 0),
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.datum_sluiting).toBeNull();
  });

  it("zonder bar-tijd blijft de sluitdatum gewoon leeg (geen Date.now-gok)", () => {
    const result = buildTradePayload(
      baseInput({ mode: { kind: "post-hoc", outcome: "BE", resultaatPct: 0 } })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.datum_sluiting).toBeNull();
  });

  it("een live-open log negeert de bar-tijd (sluitdatum hoort bij gesloten)", () => {
    const result = buildTradePayload(baseInput({ closeTimeUtcMs: Date.UTC(2026, 8, 17, 21, 30) }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.datum_sluiting).toBeNull();
  });
});

describe("buildTradePayload — degradatie (nooit stil gokken)", () => {
  it("forex-journal + onbekend symbool = expliciete fout (M5)", () => {
    const result = buildTradePayload(baseInput({ symbol: ES }));
    expect(result).toMatchObject({ ok: false, error: "symbol-not-in-pairs" });
  });

  it("niet-forex-journal accepteert een vrij instrument met pair-baseline", () => {
    const result = buildTradePayload(baseInput({ symbol: ES, isForexJournal: false }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.instrument).toBe("ES");
      expect(result.payload.pair).toBe("EURUSD"); // verborgen baseline-default (M3)
    }
  });

  it("weigert als richting en prijzen elkaar tegenspreken", () => {
    const result = buildTradePayload(baseInput({ direction: "Short" })); // SL onder entry = Long
    expect(result).toMatchObject({ ok: false, error: "direction-price-mismatch" });
  });

  it("leidt de richting af als die niet is meegegeven", () => {
    const result = buildTradePayload(baseInput({ direction: null }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.direction).toBe("Long");
  });

  it("weigert zonder bar-tijd én zonder handmatige datum", () => {
    expect(buildTradePayload(baseInput({ entryTimeUtcMs: null }))).toMatchObject({
      ok: false,
      error: "no-entry-time",
    });
  });

  it("accepteert een handmatige wall-clock als escape-hatch", () => {
    const result = buildTradePayload(
      baseInput({ entryTimeUtcMs: null, manualDateTime: { date: "2026-09-10", time: "09:30" } })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.datum_open).toBe("2026-09-10");
      expect(result.payload.tijd_open).toBe("09:30");
    }
  });

  it("weigert SL exact op entry en een lege client-uuid", () => {
    expect(
      buildTradePayload(baseInput({ prices: { entry: 110, stop: 110, target: 111 } }))
    ).toMatchObject({ ok: false, error: "stop-equals-entry" });
    expect(buildTradePayload(baseInput({ clientUuid: "  " }))).toMatchObject({
      ok: false,
      error: "empty-client-uuid",
    });
  });

  it("werkt zonder prijzen (handmatige modus): geen planned_rr, wel geldige trade", () => {
    const result = buildTradePayload(baseInput({ prices: null }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.planned_rr).toBeNull();
      expect(result.payload.entry_price).toBeNull();
      expect(result.payload.stop_price).toBeNull();
    }
  });

  it("pruned de custom-bag vóór validatie", () => {
    const result = buildTradePayload(baseInput({ custom: { zone: "Inner", leeg: "", num: NaN } }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.custom).toEqual({ zone: "Inner" });
  });
});

describe("buildTradePayload — methodologie-antwoorden (custom-bag)", () => {
  it("zet de voormalige WPM-velden in de custom-bag (fase-retirement 0059), niet in kolommen", () => {
    const result = buildTradePayload(
      baseInput({
        custom: {
          fase: "Fase 2",
          cc: "15",
          trade_concept: "Reversal",
          entry: "Decel",
          weekly_criteria: "Pattern",
          weekly_kenmerk: "Trending market",
          nieuws: true,
          w_confirm: true,
          fase2_daily_respecteert_zone: false,
          fase2_structuur: "Inner",
        },
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.custom).toEqual({
        fase: "Fase 2",
        cc: "15",
        trade_concept: "Reversal",
        entry: "Decel",
        weekly_criteria: "Pattern",
        weekly_kenmerk: "Trending market",
        nieuws: true,
        w_confirm: true,
        fase2_daily_respecteert_zone: false, // false is een echt antwoord, blijft
        fase2_structuur: "Inner",
      });
    }
  });

  it("pruned lege custom-waarden weg vóór ze de bag in gaan", () => {
    const result = buildTradePayload(baseInput({ custom: { cc: "", entry: null, num: NaN, zone: "Inner" } }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.custom).toEqual({ zone: "Inner" });
  });
});
