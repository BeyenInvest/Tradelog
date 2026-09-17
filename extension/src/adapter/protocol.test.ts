import { describe, expect, it } from "vitest";
import { isPageRequest, isPageResponse, makeRequest, makeResponse } from "./protocol";

// F4a-voorwerk: de envelope is een vertrouwensgrens — een vijandige pagina kan
// willekeurige postMessages sturen. Alles wat niet exact klopt moet false zijn.
describe("isPageRequest", () => {
  it("accepteert alleen de eigen goedgevormde envelopes", () => {
    expect(isPageRequest(makeRequest("id-1", { cmd: "read-state" }))).toBe(true);
    expect(isPageRequest(makeRequest("id-2", { cmd: "set-resolution", resolution: "240" }))).toBe(true);
  });

  it("weigert rommel, andere sources en kapotte commands", () => {
    for (const bad of [
      null,
      undefined,
      "string",
      42,
      {},
      { source: "beyen-tv-ext" },
      { source: "evil", dir: "req", id: "x", command: { cmd: "read-state" } },
      { source: "beyen-tv-ext", dir: "res", id: "x", command: { cmd: "read-state" } },
      { source: "beyen-tv-ext", dir: "req", id: 7, command: { cmd: "read-state" } },
      { source: "beyen-tv-ext", dir: "req", id: "x", command: { cmd: "self-destruct" } },
      { source: "beyen-tv-ext", dir: "req", id: "x", command: null },
      { source: "beyen-tv-ext", dir: "req", id: "x", command: { cmd: "set-resolution" } }, // resolution mist
      { source: "beyen-tv-ext", dir: "req", id: "x", command: { cmd: "set-resolution", resolution: "" } },
      { source: "beyen-tv-ext", dir: "req", id: "x", command: { cmd: "set-resolution", resolution: "X".repeat(64) } },
      { source: "beyen-tv-ext", dir: "req", id: "x", command: { cmd: "set-resolution", resolution: 240 } },
    ]) {
      expect(isPageRequest(bad)).toBe(false);
    }
  });
});

describe("isPageResponse", () => {
  it("accepteert alleen eigen responses met een payload-veld", () => {
    expect(isPageResponse(makeResponse("id-1", { any: "thing" }))).toBe(true);
    expect(isPageResponse(makeResponse("id-1", null))).toBe(true);
  });

  it("weigert alles zonder exacte envelope", () => {
    for (const bad of [
      null,
      "x",
      { source: "beyen-tv-ext", dir: "res", id: "x" }, // payload ontbreekt
      { source: "beyen-tv-ext", dir: "req", id: "x", payload: 1 },
      { source: "spoof", dir: "res", id: "x", payload: 1 },
      { source: "beyen-tv-ext", dir: "res", id: null, payload: 1 },
    ]) {
      expect(isPageResponse(bad)).toBe(false);
    }
  });
});
