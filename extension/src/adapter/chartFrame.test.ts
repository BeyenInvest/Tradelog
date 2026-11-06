import { describe, expect, it, vi } from "vitest";
import {
  anchorRightOffset, applySnapshotFrame, barIndexAtOrBefore, HISTORY_LOAD_TIMEOUT_MS, HISTORY_STALL_MS, isChartView,
  isSnapshotAnchor, resolutionSeconds, type FrameChart,
} from "./chartFrame";

const noSleep = async () => {};
const BAR_SEC = 7200; // 2H, zelfde als resolution() hieronder
const LAST = 999;

/** Chart met 130 zichtbare bars. `bars` = geladen bars, `historyBars` = wat er na
 * een load geladen is (weggelaten = er komt niets bij). */
function makeChart(overrides: Partial<FrameChart> = {}, opts: { bars?: number; historyBars?: number } = {}) {
  let firstIndex = LAST - (opts.bars ?? 1000) + 1;
  const calls: string[] = [];
  const barTime = (i: number) => 1_000_000_000 + i * BAR_SEC;
  const chart: FrameChart = {
    resetView: vi.fn(() => { calls.push("reset"); }),
    width: () => 780,
    barSpacing: () => 6,
    setRightOffset: vi.fn((n: number) => { calls.push(`offset:${n}`); }),
    firstIndex: () => firstIndex,
    lastIndex: () => LAST,
    timeAt: (i) => barTime(i),
    resolution: () => "120",
    loadRange: vi.fn(() => {
      calls.push("load");
      if (opts.historyBars) firstIndex = LAST - opts.historyBars + 1;
    }),
    ...overrides,
  };
  return { chart, calls, barTime };
}

describe("resolutionSeconds", () => {
  it("kent TV's schrijfwijzen", () => {
    expect(resolutionSeconds("120")).toBe(7200);
    expect(resolutionSeconds("240")).toBe(14_400);
    expect(resolutionSeconds("1D")).toBe(86_400);
    expect(resolutionSeconds("W")).toBe(604_800);
    expect(resolutionSeconds("M")).toBe(2_592_000);
    expect(resolutionSeconds("onzin")).toBeNull();
  });
});

describe("barIndexAtOrBefore", () => {
  const timeAt = (i: number) => 1000 + i * 100; // ook negatieve indexen, zoals TV na het laden van historie

  it("vindt de bar waarin een tijd valt", () => {
    expect(barIndexAtOrBefore(1000, -5, 10, timeAt)).toBe(0);
    expect(barIndexAtOrBefore(1099, -5, 10, timeAt)).toBe(0);
    expect(barIndexAtOrBefore(500, -5, 10, timeAt)).toBe(-5);
  });

  it("geeft de laatste bar voor een tijd in de toekomst", () => {
    expect(barIndexAtOrBefore(999_999, -5, 10, timeAt)).toBe(10);
  });

  it("geeft null voor een tijd vóór de geladen data of bij onleesbare bars", () => {
    expect(barIndexAtOrBefore(100, -5, 10, timeAt)).toBeNull();
    expect(barIndexAtOrBefore(1000, 0, 10, () => null)).toBeNull();
  });
});

describe("anchorRightOffset", () => {
  const base = { barsAfterEnd: null, visibleBars: 130 };

  it("zet een recente trade op twee derde, met lege ruimte rechts", () => {
    expect(anchorRightOffset({ ...base, barsAfterEntry: 0 })).toBe(43);
    expect(anchorRightOffset({ ...base, barsAfterEntry: 3 })).toBe(40);
  });

  it("zet een oudere trade op dezelfde plek in beeld", () => {
    expect(anchorRightOffset({ ...base, barsAfterEntry: 500 })).toBe(43 - 500);
  });

  it("geeft een lange trade meer ruimte rechts, maar houdt de entry in beeld", () => {
    expect(anchorRightOffset({ ...base, barsAfterEntry: 500, barsAfterEnd: 430 })).toBe(75 - 500);
    expect(anchorRightOffset({ ...base, barsAfterEntry: 500, barsAfterEnd: 100 })).toBe(104 - 500);
  });
});

describe("applySnapshotFrame", () => {
  it("zonder trade: de nieuwste bar op twee derde, candlebreedte blijft van TV", async () => {
    const { chart, calls } = makeChart();
    expect(await applySnapshotFrame(chart, null, noSleep)).toBe("latest");
    expect(calls).toEqual(["reset", "offset:43"]);
    expect(chart).not.toHaveProperty("setBarSpacing");
  });

  it("een recente trade krijgt lege ruimte rechts", async () => {
    const { chart, calls, barTime } = makeChart();
    expect(await applySnapshotFrame(chart, { entrySec: barTime(LAST - 3), endSec: null }, noSleep)).toBe("anchored");
    expect(calls).toEqual(["reset", "offset:40"]);
  });

  it("een oudere, geladen trade schuift in beeld zonder extra data te laden", async () => {
    const { chart, calls, barTime } = makeChart();
    expect(await applySnapshotFrame(chart, { entrySec: barTime(LAST - 250), endSec: null }, noSleep)).toBe("anchored");
    expect(calls).toEqual(["reset", `offset:${43 - 250}`]);
    expect(chart.loadRange).not.toHaveBeenCalled();
  });

  it("gebruikt het einde van de trade voor de ruimte rechts", async () => {
    const { chart, calls, barTime } = makeChart();
    const anchor = { entrySec: barTime(LAST - 250), endSec: barTime(LAST - 180) };
    expect(await applySnapshotFrame(chart, anchor, noSleep)).toBe("anchored");
    expect(calls).toEqual(["reset", `offset:${75 - 250}`]);
  });

  it("laadt oudere data en kadert daarna opnieuw", async () => {
    const { chart, calls, barTime } = makeChart({}, { bars: 300, historyBars: 2000 });
    expect(await applySnapshotFrame(chart, { entrySec: barTime(LAST - 400), endSec: null }, noSleep)).toBe("anchored");
    expect(calls).toEqual(["reset", "load", "reset", `offset:${43 - 400}`]);
  });

  it("laadt ook als de entry wel geladen is maar de aanloop ontbreekt (leeg vlak links)", async () => {
    const { chart, calls, barTime } = makeChart({}, { bars: 300, historyBars: 2000 });
    expect(await applySnapshotFrame(chart, { entrySec: barTime(LAST - 200), endSec: null }, noSleep)).toBe("anchored");
    expect(calls).toEqual(["reset", "load", "reset", `offset:${43 - 200}`]);
  });

  it("wacht niet de volle tijd als een jong symbool gewoon niet meer historie heeft", async () => {
    const sleep = vi.fn(noSleep);
    const { chart, barTime } = makeChart({}, { bars: 300 });
    expect(await applySnapshotFrame(chart, { entrySec: barTime(LAST - 200), endSec: null }, sleep)).toBe("anchored");
    expect(chart.loadRange).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls.length).toBeLessThanOrEqual(HISTORY_STALL_MS / 50);
  });

  it("wacht wél de volle tijd zolang de entry zelf nog niet binnen is, en valt dan terug", async () => {
    const sleep = vi.fn(noSleep);
    const { chart, calls, barTime } = makeChart({}, { bars: 300 });
    expect(await applySnapshotFrame(chart, { entrySec: barTime(LAST - 400), endSec: null }, sleep)).toBe("degraded");
    expect(sleep.mock.calls.length).toBe(HISTORY_LOAD_TIMEOUT_MS / 50);
    expect(calls.slice(-2)).toEqual(["reset", "offset:43"]);
  });

  it("valt terug op de reset als TV gooit tijdens het richten", async () => {
    const { chart, calls, barTime } = makeChart({
      lastIndex: () => { throw new Error("drift"); },
    });
    expect(await applySnapshotFrame(chart, { entrySec: barTime(LAST - 250), endSec: null }, noSleep)).toBe("degraded");
    expect(calls).toEqual(["reset", "reset"]);
    expect(chart.setRightOffset).not.toHaveBeenCalled();
  });

  it("richt niet bij een onbruikbare chart-breedte of spacing", async () => {
    for (const overrides of [{ width: () => 0 }, { barSpacing: () => 0 }, { barSpacing: () => Number.NaN }]) {
      const { chart, barTime } = makeChart(overrides);
      expect(await applySnapshotFrame(chart, { entrySec: barTime(LAST - 250), endSec: null }, noSleep)).toBe("degraded");
      expect(chart.setRightOffset).not.toHaveBeenCalled();
    }
  });
});

describe("vertrouwensgrens", () => {
  it("isSnapshotAnchor accepteert alleen echte tijden", () => {
    expect(isSnapshotAnchor({ entrySec: 1_700_000_000, endSec: null })).toBe(true);
    expect(isSnapshotAnchor({ entrySec: 1_700_000_000, endSec: 1_700_000_100 })).toBe(true);
    for (const bad of [null, undefined, "x", {}, { entrySec: 0, endSec: null }, { entrySec: "1", endSec: null },
      { entrySec: Number.NaN, endSec: null }, { entrySec: 1, endSec: "2" }, { entrySec: 1 }]) {
      expect(isSnapshotAnchor(bad)).toBe(false);
    }
  });

  it("isChartView accepteert ook een negatieve offset, maar geen rommel", () => {
    expect(isChartView({ barSpacing: 6, rightOffset: -150 })).toBe(true);
    for (const bad of [null, {}, { barSpacing: 0, rightOffset: 10 }, { barSpacing: 6, rightOffset: "10" },
      { barSpacing: 6, rightOffset: Number.POSITIVE_INFINITY }]) {
      expect(isChartView(bad)).toBe(false);
    }
  });
});
