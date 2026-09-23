// Unit-tests voor de pure snapshot-laag van het paneel (F3b): slot-selectie,
// wat er als screenshots meegaat, de opruimlijst en de resultaat-mapping. De
// DOM-kant (snapshotsSection.ts) is handmatig owner-getest in echte Chrome.
import { describe, expect, it } from "vitest";
import type { SnapshotCycleResult } from "../../snapshots";
import {
  applyCycle, autoSlots, DEFAULT_ENABLED, initialState, isExternalLink, needsGesture, parseEnabled,
  pathTail, screenshotsForRequest, serializeEnabled, slotLabel, slotStatus, thumbOf, uploadedPaths,
  type SnapshotState,
} from "./snapshotState";

function withSlot(state: SnapshotState, slot: "w" | "d" | "h4" | "h2", patch: Partial<SnapshotState["w"]>): SnapshotState {
  const next: SnapshotState = { ...state };
  next[slot] = { ...state[slot], ...patch };
  return next;
}

describe("slotLabel", () => {
  it("gebruikt de journal-eigen naam (0060) in web-volgorde w/d/h4/h2", () => {
    const labels = ["Screenshot Weekly", "Screenshot Daily", "Screenshot 4H", "Screenshot LTF"];
    expect(slotLabel("w", labels)).toBe("Screenshot Weekly");
    expect(slotLabel("d", labels)).toBe("Screenshot Daily");
    expect(slotLabel("h4", labels)).toBe("Screenshot 4H");
    expect(slotLabel("h2", labels)).toBe("Screenshot LTF");
  });

  it("valt per slot terug op de timeframe-default bij leeg/ontbrekend/null", () => {
    expect(slotLabel("w", null)).toBe("Weekly (W)");
    expect(slotLabel("d", undefined)).toBe("Daily (D)");
    expect(slotLabel("h4", ["", "  ", ""])).toBe("4H");
    expect(slotLabel("h2", ["Alleen weekly"])).toBe("Extra (2H)");
  });
});

describe("initialState / autoSlots", () => {
  it("start met W/D/4H aan en het extra slot uit", () => {
    const state = initialState();
    expect(autoSlots(state)).toEqual(["w", "d", "h4"]);
    expect(state.h2.enabled).toBe(false);
    expect(DEFAULT_ENABLED.h2).toBe(false);
  });

  it("laat een slot met een geldige link buiten de cyclus", () => {
    const state = withSlot(initialState(), "d", { link: " https://nl.tradingview.com/x/abc/ " });
    expect(autoSlots(state)).toEqual(["w", "h4"]);
  });

  it("houdt een slot met een onbruikbare link wél in de cyclus", () => {
    const state = withSlot(initialState(), "d", { link: "tradingview.com/x/abc" });
    expect(autoSlots(state)).toEqual(["w", "d", "h4"]);
  });

  it("accepteert alleen https-links", () => {
    expect(isExternalLink("https://nl.tradingview.com/x/abc/")).toBe(true);
    expect(isExternalLink("http://nl.tradingview.com/x/abc/")).toBe(false);
    expect(isExternalLink("javascript:alert(1)")).toBe(false);
    expect(isExternalLink("")).toBe(false);
  });
});

describe("screenshotsForRequest", () => {
  it("stuurt de link vóór het pad, en null voor een uitgezet slot", () => {
    let state = initialState();
    state = withSlot(state, "w", { result: { ok: true, path: "u1/aaa.png", bytes: 10 } });
    state = withSlot(state, "d", {
      link: "https://nl.tradingview.com/x/abc/",
      result: { ok: true, path: "u1/bbb.png", bytes: 10 },
    });
    state = withSlot(state, "h4", { enabled: false, result: { ok: true, path: "u1/ccc.png", bytes: 10 } });
    expect(screenshotsForRequest(state)).toEqual({
      w: "u1/aaa.png",
      d: "https://nl.tradingview.com/x/abc/",
      h4: null,
      h2: null,
    });
  });

  it("geeft null voor een slot waarvan de capture faalde", () => {
    const state = withSlot(initialState(), "w", { result: { ok: false, error: "boem" } });
    expect(screenshotsForRequest(state).w).toBeNull();
  });
});

describe("uploadedPaths (opruimlijst)", () => {
  it("bevat alleen echte storage-paden, nooit geplakte links", () => {
    let state = initialState();
    state = withSlot(state, "w", { result: { ok: true, path: "u1/aaa.png", bytes: 10 } });
    state = withSlot(state, "d", { link: "https://nl.tradingview.com/x/abc/" });
    state = withSlot(state, "h4", { result: { ok: false, error: "boem" } });
    expect(uploadedPaths(state)).toEqual(["u1/aaa.png"]);
  });

  it("telt ook het pad van een intussen uitgezet slot mee", () => {
    const state = withSlot(initialState(), "h4", {
      enabled: false,
      result: { ok: true, path: "u1/ccc.png", bytes: 10 },
    });
    expect(uploadedPaths(state)).toEqual(["u1/ccc.png"]);
  });
});

describe("applyCycle", () => {
  const cycle = (slots: SnapshotCycleResult["slots"], restored = true): SnapshotCycleResult => ({ slots, restored });

  it("schrijft het resultaat per slot en geeft het vervangen pad terug", () => {
    const start = withSlot(initialState(), "w", { result: { ok: true, path: "u1/oud.png", bytes: 10 } });
    const { state, stale } = applyCycle(start, ["w"], cycle({ w: { ok: true, path: "u1/nieuw.png", bytes: 12 } }));
    expect(stale).toEqual(["u1/oud.png"]);
    expect(screenshotsForRequest(state).w).toBe("u1/nieuw.png");
  });

  it("raakt slots buiten de aanvraag niet aan", () => {
    const start = withSlot(initialState(), "d", { result: { ok: true, path: "u1/d.png", bytes: 10 } });
    const { state, stale } = applyCycle(start, ["w"], cycle({ w: { ok: true, path: "u1/w.png", bytes: 10 } }));
    expect(stale).toEqual([]);
    expect(screenshotsForRequest(state).d).toBe("u1/d.png");
  });

  it("markeert een gevraagd slot dat de cyclus nooit bereikte", () => {
    const { state } = applyCycle(
      initialState(),
      ["w", "d"],
      cycle({ w: { ok: false, error: "geen gebaar", code: "needs-gesture" } })
    );
    expect(needsGesture(state)).toBe(true);
    expect(slotStatus(state.d)).toMatchObject({ kind: "error" });
    expect(slotStatus(state.d).text).toContain("niet uitgevoerd");
  });
});

describe("thumbOf", () => {
  const ok = { ok: true as const, path: "u1/a.png", bytes: 10 };

  it("geeft de preview van een geslaagd auto-slot", () => {
    const slot = { enabled: true, link: "", result: { ...ok, thumb: "data:image/jpeg;base64,abc" } };
    expect(thumbOf(slot)).toBe("data:image/jpeg;base64,abc");
  });

  it("niets zonder thumb, bij een fout, of als een link het slot overneemt", () => {
    expect(thumbOf({ enabled: true, link: "", result: ok })).toBeNull();
    expect(thumbOf({ enabled: true, link: "", result: { ok: false, error: "x" } })).toBeNull();
    expect(thumbOf({ enabled: true, link: "https://tv.com/x/1", result: { ...ok, thumb: "data:image/jpeg;base64,abc" } })).toBeNull();
  });

  it("weigert een thumb die geen image-data-URL is", () => {
    const slot = { enabled: true, link: "", result: { ...ok, thumb: "https://evil.example/x.png" } };
    expect(thumbOf(slot)).toBeNull();
  });
});

describe("slotStatus", () => {
  const base = initialState().w;

  it("beschrijft elke staat met eigen toon", () => {
    expect(slotStatus(base).kind).toBe("auto");
    expect(slotStatus({ ...base, result: { ok: true, path: "u1/a1b2c3d4.png", bytes: 1 } })).toEqual({
      kind: "ok",
      text: "…/a1b2c3d4.png",
    });
    expect(slotStatus({ ...base, result: { ok: false, error: "crop buiten beeld" } })).toEqual({
      kind: "error",
      text: "crop buiten beeld",
    });
    expect(slotStatus({ ...base, result: { ok: false, error: "x", code: "needs-gesture" } }).kind).toBe("gesture");
    expect(slotStatus({ ...base, link: "https://nl.tradingview.com/x/abc/" }).kind).toBe("link");
    expect(slotStatus({ ...base, link: "abc" }).kind).toBe("error");
  });

  it("toont een kort pad-staartje", () => {
    expect(pathTail("7f1c/a1b2.png")).toBe("…/a1b2.png");
    expect(pathTail("a1b2.png")).toBe("…/a1b2.png");
  });
});

describe("sessionStorage-serialisatie", () => {
  it("bewaart en leest de toggles terug", () => {
    const state = withSlot(initialState(), "h2", { enabled: true });
    expect(parseEnabled(serializeEnabled(state))).toEqual({ w: true, d: true, h4: true, h2: true });
  });

  it("degradeert naar de default bij rommel of gaten", () => {
    expect(parseEnabled(null)).toEqual(DEFAULT_ENABLED);
    expect(parseEnabled("niet-json")).toEqual(DEFAULT_ENABLED);
    expect(parseEnabled('{"w":false,"d":"ja"}')).toEqual({ ...DEFAULT_ENABLED, w: false });
  });
});
