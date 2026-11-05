import { describe, expect, it, vi } from "vitest";
import {
  anchorRightOffset, applySnapshotFrame, barIndexAtOrBefore, isChartView, isSnapshotAnchor, resolutionSeconds,
  SNAPSHOT_BAR_SPACING, type FrameChart,
} from "./chartFrame";

const noSleep = async () => {};

/** Chart met `bars` bars van elk 100 s, de laatste op index lastIndex. */
function makeChart(overrides: Partial<FrameChart> = {}, opts: { bars?: number; historyBars?: number } = {}) {
  const lastIndex = 299;
  let firstIndex = lastIndex - (opts.bars ?? 300) + 1;
  const calls: string[] = [];
  const barTime = (i: number) => 1_000_000 + i * 100;
  const chart: FrameChart = {
    resetView: vi.fn(() => { calls.push("reset"); }),
    width: () => 130 * SNAPSHOT_BAR_SPACING,
    rightOffset: () => 10,
    setBarSpacing: vi.fn((px: number) => { calls.push(`spacing:${px}`); }),
    setRightOffset: vi.fn((n: number) => { calls.push(`offset:${n}`); }),
    firstIndex: () => firstIndex,
    lastIndex: () => lastIndex,
    timeAt: (i) => barTime(i),
    resolution: () => "120",
    loadRange: vi.fn(() => {
      calls.push("load");
      if (opts.historyBars) firstIndex = lastIndex - opts.historyBars + 1;
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
  const base = { barsAfterEnd: null, visibleBars: 130, defaultOffset: 10 };

  it("laat het beeld staan als de trade er met aanloop in past", () => {
    expect(anchorRightOffset({ ...base, barsAfterEntry: 0 })).toBeNull();
    expect(anchorRightOffset({ ...base, barsAfterEntry: 100 })).toBeNull();
  });

  it("schuift een oudere trade in beeld, met twee derde aanloop", () => {
    expect(anchorRightOffset({ ...base, barsAfterEntry: 500 })).toBe(43 - 500);
  });

  it("geeft een lange trade meer ruimte rechts, maar houdt de entry in beeld", () => {
    expect(anchorRightOffset({ ...base, barsAfterEntry: 500, barsAfterEnd: 430 })).toBe(75 - 500);
    expect(anchorRightOffset({ ...base, barsAfterEntry: 500, barsAfterEnd: 100 })).toBe(104 - 500);
  });

  it("schuift nooit voorbij het standaardbeeld", () => {
    expect(anchorRightOffset({ ...base, barsAfterEntry: 111, barsAfterEnd: 0 })).toBeLessThanOrEqual(10);
  });
});

describe("applySnapshotFrame", () => {
  it("zonder trade: reset, dan vast aantal bars bij de nieuwste bar", async () => {
    const { chart, calls } = makeChart();
    expect(await applySnapshotFrame(chart, null, noSleep)).toBe("latest");
    expect(calls).toEqual(["reset", "spacing:8"]);
  });

  it("houdt op elk scherm dezelfde candlebreedte", async () => {
    for (const width of [800, 1654, 3440]) {
      const { chart, calls } = makeChart({ width: () => width });
      await applySnapshotFrame(chart, null, noSleep);
      expect(calls).toEqual(["reset", "spacing:8"]);
    }
  });

  it("op een breder scherm past een oudere trade vanzelf in het standaardbeeld", async () => {
    const { chart, barTime } = makeChart({ width: () => 400 * SNAPSHOT_BAR_SPACING });
    expect(await applySnapshotFrame(chart, { entrySec: barTime(49), endSec: null }, noSleep)).toBe("latest");
    expect(chart.setRightOffset).not.toHaveBeenCalled();
  });

  it("een recente trade blijft in het standaardbeeld", async () => {
    const { chart, calls, barTime } = makeChart();
    expect(await applySnapshotFrame(chart, { entrySec: barTime(280), endSec: null }, noSleep)).toBe("latest");
    expect(calls).toEqual(["reset", "spacing:8"]);
  });

  it("een oudere, geladen trade schuift in beeld zonder extra data te laden", async () => {
    const { chart, calls, barTime } = makeChart();
    expect(await applySnapshotFrame(chart, { entrySec: barTime(49), endSec: null }, noSleep)).toBe("anchored");
    expect(calls).toEqual(["reset", "spacing:8", `offset:${43 - 250}`]);
    expect(chart.loadRange).not.toHaveBeenCalled();
  });

  it("laadt oudere data en kadert daarna opnieuw", async () => {
    const { chart, calls, barTime } = makeChart({}, { bars: 300, historyBars: 1000 });
    expect(await applySnapshotFrame(chart, { entrySec: barTime(-100), endSec: null }, noSleep)).toBe("anchored");
    expect(calls).toEqual(["reset", "spacing:8", "load", "reset", "spacing:8", `offset:${43 - 399}`]);
  });

  it("valt terug op de nieuwste bars als de oudere data niet komt", async () => {
    const { chart, calls, barTime } = makeChart();
    expect(await applySnapshotFrame(chart, { entrySec: barTime(-100), endSec: null }, noSleep)).toBe("degraded");
    expect(calls.slice(-2)).toEqual(["reset", "spacing:8"]);
    expect(chart.setRightOffset).not.toHaveBeenCalled();
  });

  it("valt terug op de nieuwste bars als TV gooit tijdens het richten", async () => {
    const { chart, calls, barTime } = makeChart({
      lastIndex: () => { throw new Error("drift"); },
    });
    expect(await applySnapshotFrame(chart, { entrySec: barTime(49), endSec: null }, noSleep)).toBe("degraded");
    expect(calls).toEqual(["reset", "spacing:8", "reset", "spacing:8"]);
  });

  it("richt niet bij een onbruikbare chart-breedte", async () => {
    const { chart, barTime } = makeChart({ width: () => 0 });
    expect(await applySnapshotFrame(chart, { entrySec: barTime(49), endSec: null }, noSleep)).toBe("degraded");
    expect(chart.setRightOffset).not.toHaveBeenCalled();
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
