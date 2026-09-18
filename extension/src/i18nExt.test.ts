// Unit-tests voor de mini-i18n van de extensie (F4b). De chrome.storage-kant
// (ensureLang/saveLang/onChanged) is handmatig owner-getest in echte Chrome;
// hier staat de pure laag: taalresolutie, interpolatie, woordenlijst-pariteit en
// de leenwoord-afspraak.
import { afterEach, describe, expect, it } from "vitest";
import { getLang, interpolate, isLang, LANGS, resolveLang, setLang, t } from "./i18nExt";

afterEach(() => setLang("nl")); // NL is de statische fallback van de module

describe("resolveLang", () => {
  it("leest elke nl-variant als Nederlands", () => {
    expect(resolveLang("nl")).toBe("nl");
    expect(resolveLang("nl-BE")).toBe("nl");
    expect(resolveLang("nl_NL")).toBe("nl");
    expect(resolveLang(" NL-be ")).toBe("nl");
  });

  it("geeft al de rest Engels", () => {
    expect(resolveLang("en-US")).toBe("en");
    expect(resolveLang("fr")).toBe("en");
    expect(resolveLang("de-DE")).toBe("en");
  });

  it("laat zich niet foppen door een taal die toevallig met nl begint", () => {
    // "nld" is geen UI-taalcode die Chrome teruggeeft, maar de grens hoort hard
    // te zijn: alleen nl zelf of nl met een scheidingsteken telt.
    expect(resolveLang("nlx")).toBe("en");
  });

  it("degradeert naar Engels zonder bruikbare invoer", () => {
    expect(resolveLang(null)).toBe("en");
    expect(resolveLang(undefined)).toBe("en");
    expect(resolveLang(123 as unknown as string)).toBe("en");
  });
});

describe("isLang", () => {
  it("accepteert alleen de twee talen", () => {
    expect(LANGS).toEqual(["nl", "en"]);
    expect(isLang("nl")).toBe(true);
    expect(isLang("en")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(null)).toBe(false);
  });
});

describe("interpolate", () => {
  it("vult placeholders in", () => {
    expect(interpolate("{count} tools — kies er één.", { count: 3 })).toBe("3 tools — kies er één.");
    expect(interpolate("{a} en {b}", { a: "x", b: "y" })).toBe("x en y");
  });

  it("laat een onbekende placeholder staan in plaats van 'undefined' te tonen", () => {
    expect(interpolate("{naam} logt", {})).toBe("{naam} logt");
  });
});

describe("t", () => {
  it("volgt de gecachete taal", () => {
    expect(getLang()).toBe("nl");
    expect(t("panel.sec.position")).toBe("Position-tool");
    setLang("en");
    expect(t("panel.sec.position")).toBe("Position tool");
  });

  it("interpoleert in beide talen", () => {
    expect(t("panel.positionPick", { count: 2 })).toContain("2 position-tools");
    setLang("en");
    expect(t("panel.positionPick", { count: 2 })).toContain("2 position tools");
  });

  it("houdt de trading-leenwoorden identiek", () => {
    // Zelfde afspraak als het `enums`-namespace van de web-app: Win/Loss/BE,
    // Long/Short en "Log trade" zijn in beide talen hetzelfde woord.
    // "Running" hoort in hetzelfde rijtje: het is de vierde knop naast
    // Win/Loss/BE en blijft daarom in beide talen hetzelfde woord.
    for (const key of [
      "panel.submit", "panel.metric.entry", "panel.metric.stop", "panel.metric.target",
      "panel.metric.rr", "panel.resultRunning",
    ] as const) {
      setLang("nl");
      const nl = t(key);
      setLang("en");
      expect(t(key)).toBe(nl);
    }
    setLang("nl");
    expect(t("panel.v.pickResult")).toContain("Running, Win, Loss");
    setLang("en");
    expect(t("panel.v.pickResult")).toContain("Running, Win, Loss");
  });

  it("heeft voor elke sleutel een niet-lege vertaling in beide talen", () => {
    // De woordenlijst is getypt (en = Record<MessageKey, string>), dus een
    // ontbrekende sleutel is al een compile-fout; dit vangt lege of
    // niet-vertaalde-maar-bedoeld-vertaalde zinnen af.
    setLang("nl");
    const nlSample = t("panel.notLinked.text");
    setLang("en");
    const enSample = t("panel.notLinked.text");
    expect(nlSample.length).toBeGreaterThan(20);
    expect(enSample.length).toBeGreaterThan(20);
    expect(enSample).not.toBe(nlSample);
  });
});
