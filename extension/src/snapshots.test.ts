import { describe, expect, it, vi } from "vitest";
import {
  bytesToBase64, runSnapshotCycle, SNAPSHOT_MAX_BYTES, THUMB_MAX_CHARS, type SnapshotDeps,
} from "./snapshots";

function makeDeps(overrides: Partial<SnapshotDeps> = {}) {
  let resolution = "240";
  const calls: string[] = [];
  const deps: SnapshotDeps = {
    getResolution: vi.fn(async () => resolution),
    setResolution: vi.fn(async (r: string) => {
      calls.push(`set:${r}`);
      resolution = r;
      return true;
    }),
    capture: vi.fn(async () => {
      calls.push(`capture:${resolution}`);
      return { ok: true as const, image: new Blob(["png"]) };
    }),
    upload: vi.fn(async () => ({ ok: true as const, path: `u1/${calls.length}.png` })),
    settle: vi.fn(async (target: string) => {
      calls.push(`settle:${target}`);
    }),
    ...overrides,
  };
  return { deps, calls };
}

describe("runSnapshotCycle", () => {
  it("doorloopt de slots in vaste volgorde en herstelt het oorspronkelijke timeframe", async () => {
    const { deps, calls } = makeDeps();
    const result = await runSnapshotCycle(deps, ["h2", "w", "d"]); // bewust door elkaar
    expect(calls.filter((c) => c.startsWith("capture"))).toEqual(["capture:W", "capture:D", "capture:120"]);
    expect(calls[calls.length - 1]).toBe("set:240"); // terug naar start
    expect(result.restored).toBe(true);
    expect(result.slots.w?.ok).toBe(true);
    expect(result.slots.d?.ok).toBe(true);
    expect(result.slots.h2?.ok).toBe(true);
    expect(result.slots.h4).toBeUndefined(); // niet gevraagd
  });

  it("slaat het switchen over als de chart al op het slot-timeframe staat, maar settlet wél", async () => {
    const { deps, calls } = makeDeps();
    await runSnapshotCycle(deps, ["h4"]); // chart staat al op 240
    // Geen set en geen herstel — maar wél settlen: de chart kan nog aan het
    // laden zijn van een handmatige timeframe-wissel vlak vóór de cyclus.
    expect(calls).toEqual(["settle:240", "capture:240"]);
  });

  it("settlet op het doel-timeframe vóór elke capture (ladende chart, F3a-settle-fix)", async () => {
    const { deps, calls } = makeDeps();
    await runSnapshotCycle(deps, ["w"]); // chart start op 240
    expect(calls).toEqual(["set:W", "settle:W", "capture:W", "set:240"]);
  });

  it("wisselt óók terug naar het start-timeframe als dat zelf een slot is (W-D-D-bug)", async () => {
    // Chart start op 4H; na de W- en D-captures staat hij op D. Het 4H-slot mag
    // dan niet "al goed" denken op basis van de start-resolutie — dat leverde
    // een tweede Daily-screenshot op in het 4H-slot.
    const { deps, calls } = makeDeps();
    const result = await runSnapshotCycle(deps, ["w", "d", "h4"]);
    expect(calls.filter((c) => c.startsWith("capture"))).toEqual(["capture:W", "capture:D", "capture:240"]);
    expect(result.slots.h4?.ok).toBe(true);
    expect(result.restored).toBe(true);
  });

  it("stopt vroeg en markeert needs-gesture bij een activeTab-permissiefout (fallback-pad)", async () => {
    const { deps } = makeDeps({
      capture: vi.fn(async () => ({
        ok: false as const,
        error: "Either the '<all_urls>' or 'activeTab' permission is required.",
        code: "needs-gesture" as const,
      })),
    });
    const result = await runSnapshotCycle(deps, ["w", "d"]);
    expect(result.slots.w).toMatchObject({ ok: false, code: "needs-gesture" });
    expect(result.slots.d).toBeUndefined(); // vroeg gestopt — d is nooit geprobeerd
    expect(result.restored).toBe(true); // maar het timeframe is wél hersteld
  });

  it("een mislukte switch faalt alleen dat slot", async () => {
    const { deps } = makeDeps({
      setResolution: vi.fn(async (r: string) => r !== "W"),
    });
    const result = await runSnapshotCycle(deps, ["w", "d"]);
    expect(result.slots.w?.ok).toBe(false);
    expect(result.slots.d?.ok).toBe(true);
  });

  it("weigert een snapshot boven de bucket-limiet vóór de upload", async () => {
    const big = { size: SNAPSHOT_MAX_BYTES + 1 } as Blob;
    const upload = vi.fn(async () => ({ ok: true as const, path: "x" }));
    const { deps } = makeDeps({ capture: vi.fn(async () => ({ ok: true as const, image: big })), upload });
    const result = await runSnapshotCycle(deps, ["d"]);
    expect(result.slots.d?.ok).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });

  it("neemt een preview-thumb mee in een geslaagd slot", async () => {
    const { deps } = makeDeps({ thumbnail: vi.fn(async () => "data:image/jpeg;base64,abc") });
    const result = await runSnapshotCycle(deps, ["d"]);
    expect(result.slots.d).toMatchObject({ ok: true, thumb: "data:image/jpeg;base64,abc" });
  });

  it("een falende of te grote thumbnail laat het slot gewoon slagen, zonder thumb", async () => {
    const failing = makeDeps({ thumbnail: vi.fn(async () => { throw new Error("canvas kapot"); }) });
    const failed = await runSnapshotCycle(failing.deps, ["d"]);
    expect(failed.slots.d?.ok).toBe(true);
    if (failed.slots.d?.ok) expect(failed.slots.d.thumb).toBeUndefined();

    const huge = makeDeps({ thumbnail: vi.fn(async () => "x".repeat(THUMB_MAX_CHARS + 1)) });
    const capped = await runSnapshotCycle(huge.deps, ["d"]);
    expect(capped.slots.d?.ok).toBe(true);
    if (capped.slots.d?.ok) expect(capped.slots.d.thumb).toBeUndefined();
  });

  it("geeft upload-fouten per slot door en herstelt daarna alsnog", async () => {
    const { deps, calls } = makeDeps({
      upload: vi.fn(async () => ({ ok: false as const, error: "bucket vol" })),
    });
    const result = await runSnapshotCycle(deps, ["w"]);
    expect(result.slots.w).toMatchObject({ ok: false });
    if (result.slots.w && !result.slots.w.ok) expect(result.slots.w.error).toContain("bucket vol");
    expect(calls[calls.length - 1]).toBe("set:240");
  });
});

describe("bytesToBase64", () => {
  it("codeert correct, ook over de chunk-grens heen", () => {
    const small = new TextEncoder().encode("beyen");
    expect(atob(bytesToBase64(small))).toBe("beyen");
    const big = new Uint8Array(0x8000 + 17).fill(65); // net over één chunk
    expect(atob(bytesToBase64(big))).toBe("A".repeat(0x8000 + 17));
  });
});
