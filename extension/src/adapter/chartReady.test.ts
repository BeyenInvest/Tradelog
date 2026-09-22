import { describe, expect, it } from "vitest";
import {
  BAR_STABLE_OVERRIDE_MS, BLIND_FALLBACK_MS, normalizeResolution, READY_TIMEOUT_MS, waitForChartReady,
  type BarProbe, type ReadyProbe,
} from "./chartReady";

/** Virtuele klok: sleep() schuift de tijd op zonder echte timers. */
function clock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

/** Probe die per poll-ronde uit scripts leest; het laatste element blijft gelden. */
function scriptedProbe(script: {
  resolution?: Array<string | null>;
  dataReady?: Array<boolean | null>;
  lastBar?: BarProbe[];
}): ReadyProbe {
  let round = -1;
  const pick = <T>(arr: T[] | undefined, fallback: T): T => {
    if (!arr || arr.length === 0) return fallback;
    return arr[Math.min(round, arr.length - 1)];
  };
  return {
    resolution() {
      round += 1; // resolution wordt als eerste per ronde gelezen → telt de ronde
      return pick(script.resolution, "D");
    },
    dataReady: () => pick(script.dataReady, null),
    lastBar: () => pick(script.lastBar, { kind: "unreadable" }),
  };
}

describe("normalizeResolution", () => {
  it("maakt TV's post-switch-vormen gelijk aan onze doelen", () => {
    expect(normalizeResolution("1D")).toBe("D");
    expect(normalizeResolution("1W")).toBe("W");
    expect(normalizeResolution("1M")).toBe("M");
    expect(normalizeResolution("D")).toBe("D");
    expect(normalizeResolution("240")).toBe("240");
    expect(normalizeResolution("120")).toBe("120");
    expect(normalizeResolution("12M")).toBe("12M"); // alleen de kale 1-prefix strippen
  });
});

describe("waitForChartReady", () => {
  it("herkent TV's '1W' als het gevraagde 'W' (geen 5s-timeout op een geladen chart)", async () => {
    const c = clock();
    const out = await waitForChartReady(
      scriptedProbe({ resolution: ["1W"], dataReady: [true], lastBar: [{ kind: "bar", time: 100 }] }),
      "W",
      { now: c.now, sleep: c.sleep },
    );
    expect(out).toMatchObject({ ready: true, signal: "data-ready", polls: 1 });
  });

  it("is meteen klaar als dataReady=true en er een bar staat (geen wachttijd)", async () => {
    const c = clock();
    const out = await waitForChartReady(
      scriptedProbe({ dataReady: [true], lastBar: [{ kind: "bar", time: 100 }] }),
      "D",
      { now: c.now, sleep: c.sleep },
    );
    expect(out).toMatchObject({ ready: true, signal: "data-ready", waitedMs: 0, polls: 1 });
  });

  it("wacht tot dataReady van false naar true klapt", async () => {
    const c = clock();
    const out = await waitForChartReady(
      scriptedProbe({ dataReady: [false, false, false, true], lastBar: [{ kind: "bar", time: 100 }] }),
      "D",
      { now: c.now, sleep: c.sleep },
    );
    expect(out).toMatchObject({ ready: true, signal: "data-ready", polls: 4, waitedMs: 450 });
  });

  it("dataReady=true maar een lege serie is nog niet klaar (mid-switch)", async () => {
    const c = clock();
    const out = await waitForChartReady(
      scriptedProbe({
        dataReady: [true],
        lastBar: [{ kind: "empty" }, { kind: "empty" }, { kind: "bar", time: 7 }],
      }),
      "D",
      { now: c.now, sleep: c.sleep },
    );
    expect(out).toMatchObject({ ready: true, signal: "data-ready", polls: 3 });
  });

  it("valt zonder dataReady terug op een stabiele laatste bar (twee gelijke polls)", async () => {
    const c = clock();
    const out = await waitForChartReady(
      scriptedProbe({
        lastBar: [
          { kind: "bar", time: 10 },
          { kind: "bar", time: 20 }, // nog aan het bijladen
          { kind: "bar", time: 20 }, // stabiel
        ],
      }),
      "D",
      { now: c.now, sleep: c.sleep },
    );
    expect(out).toMatchObject({ ready: true, signal: "bar-stable", polls: 3, waitedMs: 300 });
  });

  it("reset de stabiliteitscheck zolang het timeframe nog niet klopt", async () => {
    const c = clock();
    const out = await waitForChartReady(
      scriptedProbe({
        resolution: ["240", "240", "D"],
        lastBar: [{ kind: "bar", time: 5 }], // zelfde bar-tijd vanaf ronde 1
      }),
      "D",
      { now: c.now, sleep: c.sleep },
    );
    // Rondes 1-2 tellen niet mee (verkeerd timeframe); pas op D begint de
    // vergelijking, dus stabiel op ronde 4 — niet al op ronde 2.
    expect(out).toMatchObject({ ready: true, signal: "bar-stable", polls: 4 });
  });

  it("dataReady=false blokkeert bar-stable eerst, maar ná de override-drempel wint de stabiele bar", async () => {
    // Sommige TV-builds houden dataReady=false zolang een trage study laadt —
    // vóór de fix kostte dat de volle 5s-timeout per slot terwijl de candles
    // er allang stonden.
    const c = clock();
    const out = await waitForChartReady(
      scriptedProbe({ dataReady: [false], lastBar: [{ kind: "bar", time: 5 }] }),
      "D",
      { now: c.now, sleep: c.sleep },
    );
    expect(out).toMatchObject({ ready: true, signal: "bar-stable" });
    expect(out.waitedMs).toBeGreaterThanOrEqual(BAR_STABLE_OVERRIDE_MS);
    expect(out.waitedMs).toBeLessThan(READY_TIMEOUT_MS);
  });

  it("dataReady=false met een nog schuivende bar blijft wachten tot de nette timeout", async () => {
    const c = clock();
    let barTime = 0;
    const probe: ReadyProbe = {
      resolution: () => "D",
      dataReady: () => false,
      lastBar: () => ({ kind: "bar", time: (barTime += 1) }), // elke poll een andere bar → nooit stabiel
    };
    const out = await waitForChartReady(probe, "D", { now: c.now, sleep: c.sleep });
    expect(out).toMatchObject({ ready: false, signal: "timeout" });
    expect(out.waitedMs).toBeGreaterThanOrEqual(READY_TIMEOUT_MS);
  });

  it("volledig blinde adapter → door na de oude vaste wachttijd (vloer, geen 5s-hang)", async () => {
    const c = clock();
    const out = await waitForChartReady(
      scriptedProbe({ resolution: [null], dataReady: [null], lastBar: [{ kind: "unreadable" }] }),
      "D",
      { now: c.now, sleep: c.sleep },
    );
    expect(out).toMatchObject({ ready: true, signal: "blind-fallback" });
    expect(out.waitedMs).toBeGreaterThanOrEqual(BLIND_FALLBACK_MS);
    expect(out.waitedMs).toBeLessThan(READY_TIMEOUT_MS);
  });

  it("timeframe dat nooit omschakelt → nette timeout, ready=false", async () => {
    const c = clock();
    const out = await waitForChartReady(
      scriptedProbe({ resolution: ["240"], dataReady: [true], lastBar: [{ kind: "bar", time: 1 }] }),
      "D",
      { now: c.now, sleep: c.sleep },
    );
    expect(out).toMatchObject({ ready: false, signal: "timeout" });
    expect(out.waitedMs).toBeGreaterThanOrEqual(READY_TIMEOUT_MS);
  });

  it("bar zonder bruikbare tijd kan niet stabiliseren maar dataReady wint alsnog", async () => {
    const c = clock();
    const out = await waitForChartReady(
      scriptedProbe({
        dataReady: [null, null, true],
        lastBar: [{ kind: "bar", time: null }],
      }),
      "D",
      { now: c.now, sleep: c.sleep },
    );
    expect(out).toMatchObject({ ready: true, signal: "data-ready", polls: 3 });
  });
});
