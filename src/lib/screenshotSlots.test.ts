import { describe, expect, it } from "vitest";
import {
  customTimeframeLabel, DEFAULT_SLOT_TIMEFRAMES, isSnapshotTimeframe, resolveSlotTimeframes, screenshotSlotLabel,
  SLOT_COUNT, SNAPSHOT_TIMEFRAMES, timeframeLabel,
} from "./screenshotSlots";

describe("screenshotSlots", () => {
  it("defaults spiegelen het oude vaste W/D/4H/2H en zitten zelf in de whitelist", () => {
    expect(DEFAULT_SLOT_TIMEFRAMES).toEqual(["W", "D", "240", "120"]);
    expect(DEFAULT_SLOT_TIMEFRAMES).toHaveLength(SLOT_COUNT);
    for (const tf of DEFAULT_SLOT_TIMEFRAMES) expect(isSnapshotTimeframe(tf)).toBe(true);
  });

  it("isSnapshotTimeframe accepteert alleen de aangeboden TV-resolutions", () => {
    expect(isSnapshotTimeframe("15")).toBe(true);
    expect(isSnapshotTimeframe("D")).toBe(true);
    // Geen vrije strings over de trust boundary — ook geen bijna-goede.
    expect(isSnapshotTimeframe("1D")).toBe(false);
    expect(isSnapshotTimeframe("7")).toBe(false);
    expect(isSnapshotTimeframe("")).toBe(false);
    expect(isSnapshotTimeframe(15)).toBe(false);
    expect(isSnapshotTimeframe(null)).toBe(false);
  });

  it("timeframeLabel toont resolutions zoals de trader ze kent", () => {
    expect(timeframeLabel("1")).toBe("1m");
    expect(timeframeLabel("45")).toBe("45m");
    expect(timeframeLabel("60")).toBe("1H");
    expect(timeframeLabel("240")).toBe("4H");
    expect(timeframeLabel("D")).toBe("D");
    expect(timeframeLabel("W")).toBe("W");
    // Elke aangeboden optie heeft een leesbaar label (geen rauwe minuten ≥ 60).
    for (const tf of SNAPSHOT_TIMEFRAMES) expect(timeframeLabel(tf)).toMatch(/^(\d+m|\d+H|[DWM])$/);
  });

  it("resolveSlotTimeframes: geldige waarde wint, al het andere valt per positie terug op de default", () => {
    expect(resolveSlotTimeframes(null)).toEqual(["W", "D", "240", "120"]);
    expect(resolveSlotTimeframes(undefined)).toEqual(["W", "D", "240", "120"]);
    expect(resolveSlotTimeframes(["15", "", "60"])).toEqual(["15", "D", "60", "120"]);
    expect(resolveSlotTimeframes([" 15 ", 42, "999", null])).toEqual(["15", "D", "240", "120"]);
  });

  it("customTimeframeLabel: alleen een afwijkende TF levert een default-naam op", () => {
    expect(customTimeframeLabel(["15", "", "", ""], 0)).toBe("15m");
    expect(customTimeframeLabel(["15", "", "", ""], 1)).toBeNull(); // slot op default
    expect(customTimeframeLabel(["W", "", "", ""], 0)).toBeNull(); // expliciet de default gekozen
    expect(customTimeframeLabel(null, 2)).toBeNull();
    expect(customTimeframeLabel(["", "", "", "5"], 3)).toBe("5m");
  });

  it("slot-naam: eigen naam > afwijkende TF > vaste default", () => {
    const defs = ["Weekly", "Daily", "4H", "Extra"];
    expect(screenshotSlotLabel(null, null, defs, 0)).toBe("Weekly");
    expect(screenshotSlotLabel(["", " ", null as unknown as string, "Mijn 15m"], null, defs, 3)).toBe("Mijn 15m");
    expect(screenshotSlotLabel(["  "], ["15"], defs, 0)).toBe("15m");
    expect(screenshotSlotLabel(["Top-down"], ["15"], defs, 0)).toBe("Top-down");
  });
});
