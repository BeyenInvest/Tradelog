import { describe, expect, it, vi } from "vitest";

// index.ts importeert de Supabase-client (voor ctraderApi); die gooit zonder
// VITE_SUPABASE_*-env, en CI heeft geen .env.local. Deze tests raken hem niet.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
import { positionsToDeals } from "./index";
import { prepareImport } from "@/lib/import";

describe("positionsToDeals → prepareImport", () => {
  const positions = [
    {
      positionId: "77",
      symbol: "EURUSD",
      side: "sell" as const,
      // Zondag 5 okt 2026 21:30 UTC = 23:30 Brussel → handelsweek-zondag-regel moet tijd_open zien.
      openTs: Date.parse("2026-10-05T21:30:00Z"),
      closeTs: Date.parse("2026-10-06T08:00:00Z"),
      netPnl: -45.5,
      balanceAfter: 9954.5,
      returnPct: -0.46,
    },
  ];

  it("wall-clock in de profiel-tijdzone, unieke ref per account, exact %", () => {
    const deals = positionsToDeals(positions, 555, "Europe/Brussels");
    const prepared = prepareImport(deals, "ctrader", {
      pairMap: {},
      accountBalance: null,
      existingImportRefs: new Set(),
    });
    expect(prepared.rows).toHaveLength(1);
    const row = prepared.rows[0];
    expect(row.import_ref).toBe("ctrader:555:77");
    expect(row.datum_open).toBe("2026-10-05");
    expect(row.tijd_open).toBe("23:30");
    expect(row.datum_sluiting).toBe("2026-10-06");
    expect(row.direction).toBe("Short");
    expect(row.outcome).toBe("Loss");
    expect(row.resultaat_pct).toBe(-0.46);
    expect(row.trade_evaluation).toBeNull();
  });

  it("tweede sync van dezelfde positie dedupt", () => {
    const deals = positionsToDeals(positions, 555, "Europe/Brussels");
    const prepared = prepareImport(deals, "ctrader", {
      pairMap: {},
      accountBalance: null,
      existingImportRefs: new Set(["ctrader:555:77"]),
    });
    expect(prepared.rows).toHaveLength(0);
    expect(prepared.duplicateCount).toBe(1);
  });

  it("onbekend symbool in een forex-journal blokkeert (pending), niet-forex neemt het over", () => {
    const deals = positionsToDeals([{ ...positions[0], symbol: "US30" }], 555, "UTC");
    const forex = prepareImport(deals, "ctrader", { pairMap: {}, accountBalance: null, existingImportRefs: new Set() });
    expect(forex.unknownSymbols).toEqual(["US30"]);
    const indices = prepareImport(deals, "ctrader", {
      pairMap: {},
      accountBalance: null,
      existingImportRefs: new Set(),
      forexJournal: false,
    });
    expect(indices.rows[0].instrument).toBe("US30");
  });
});
