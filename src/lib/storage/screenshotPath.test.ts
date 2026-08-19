import { describe, it, expect } from "vitest";
import { isStoragePath, toExternalUrl } from "./screenshotPath";

const UID = "1f2e3d4c-5b6a-4788-9900-aabbccddeeff";

describe("isStoragePath", () => {
  it("recognises an uploaded bucket path (uuid folder prefix)", () => {
    expect(isStoragePath(`${UID}/${UID}.png`)).toBe(true);
    expect(isStoragePath(`${UID}/abc.webp`)).toBe(true);
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(isStoragePath(`  ${UID.toUpperCase()}/x.jpg  `)).toBe(true);
  });

  it("treats full and schemeless URLs as NOT storage paths", () => {
    expect(isStoragePath("https://tradingview.com/x/abc.png")).toBe(false);
    expect(isStoragePath("http://example.com/a.png")).toBe(false);
    expect(isStoragePath("example.com/chart.png")).toBe(false);
  });

  it("does not match a bare uuid without a following path segment", () => {
    expect(isStoragePath(UID)).toBe(false);
    expect(isStoragePath("")).toBe(false);
  });
});

describe("toExternalUrl", () => {
  it("passes through http(s) URLs unchanged", () => {
    expect(toExternalUrl("https://a.com/x.png")).toBe("https://a.com/x.png");
    expect(toExternalUrl("http://a.com/x.png")).toBe("http://a.com/x.png");
  });

  it("prepends https:// to a schemeless host (legacy URL-field parity)", () => {
    expect(toExternalUrl("example.com/chart.png")).toBe("https://example.com/chart.png");
  });

  it("trims before deciding", () => {
    expect(toExternalUrl("  https://a.com/x.png  ")).toBe("https://a.com/x.png");
  });
});
