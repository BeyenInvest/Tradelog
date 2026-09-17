import { describe, expect, it } from "vitest";
import { clampLauncherPos, isDrag, parseStoredPos } from "./launcherDrag";

describe("parseStoredPos", () => {
  it("accepteert alleen een eindig {x,y}-paar", () => {
    expect(parseStoredPos({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
    expect(parseStoredPos(null)).toBeNull();
    expect(parseStoredPos("10,20")).toBeNull();
    expect(parseStoredPos({ x: 10 })).toBeNull();
    expect(parseStoredPos({ x: NaN, y: 2 })).toBeNull();
    expect(parseStoredPos({ x: Infinity, y: 2 })).toBeNull();
  });
});

describe("clampLauncherPos", () => {
  const size = { w: 40, h: 40 };
  const viewport = { w: 1000, h: 600 };

  it("laat een positie binnen het viewport ongemoeid", () => {
    expect(clampLauncherPos({ x: 300, y: 200 }, size, viewport)).toEqual({ x: 300, y: 200 });
  });

  it("klemt buiten-beeld-posities terug met marge", () => {
    expect(clampLauncherPos({ x: -50, y: -50 }, size, viewport)).toEqual({ x: 8, y: 8 });
    expect(clampLauncherPos({ x: 5000, y: 5000 }, size, viewport)).toEqual({ x: 952, y: 552 });
  });

  it("een element groter dan het viewport houdt zijn kop zichtbaar (links/boven wint)", () => {
    expect(clampLauncherPos({ x: 100, y: 100 }, { w: 2000, h: 2000 }, viewport)).toEqual({ x: 8, y: 8 });
  });
});

describe("isDrag", () => {
  it("kleine bewegingen blijven een klik, grotere worden een sleep", () => {
    expect(isDrag(2, 2)).toBeFalsy();
    expect(isDrag(0, 5)).toBe(true);
    expect(isDrag(3, 3)).toBe(true); // hypot ≈ 4.24
  });
});
