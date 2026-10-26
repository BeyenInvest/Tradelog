import { describe, expect, it } from "vitest";
import { clampPanelSize, PANEL_MIN, parseStoredSize } from "./panelSize";

describe("parseStoredSize", () => {
  it("accepteert alleen een eindig, positief {w,h}-paar", () => {
    expect(parseStoredSize({ w: 420, h: 600 })).toEqual({ w: 420, h: 600 });
    expect(parseStoredSize(null)).toBeNull();
    expect(parseStoredSize({ w: 420 })).toBeNull();
    expect(parseStoredSize({ w: NaN, h: 600 })).toBeNull();
    expect(parseStoredSize({ w: 0, h: 600 })).toBeNull();
    expect(parseStoredSize({ w: -5, h: 600 })).toBeNull();
  });
});

describe("clampPanelSize", () => {
  const available = { w: 900, h: 700 };

  it("laat een maat binnen de grenzen ongemoeid (afgerond)", () => {
    expect(clampPanelSize({ w: 420.4, h: 600.6 }, available)).toEqual({ w: 420, h: 601 });
  });

  it("klemt op het minimum en op de beschikbare ruimte", () => {
    expect(clampPanelSize({ w: 100, h: 100 }, available)).toEqual(PANEL_MIN);
    expect(clampPanelSize({ w: 5000, h: 5000 }, available)).toEqual(available);
  });

  it("minder ruimte dan het minimum → het minimum wint", () => {
    expect(clampPanelSize({ w: 500, h: 500 }, { w: 200, h: 150 })).toEqual(PANEL_MIN);
  });
});
