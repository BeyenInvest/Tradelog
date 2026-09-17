import { describe, expect, it, vi } from "vitest";
import { runSnapshotCycle, SNAPSHOT_MAX_BYTES, type SnapshotDeps } from "./snapshots";

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
    getChartRect: vi.fn(async () => ({ x: 0, y: 0, w: 100, h: 100, dpr: 1 })),
    captureVisible: vi.fn(async () => {
      calls.push(`capture:${resolution}`);
      return new Blob(["png"]);
    }),
    crop: vi.fn(async (b: Blob) => b),
    upload: vi.fn(async () => ({ ok: true as const, path: `u1/${calls.length}.png` })),
    settle: vi.fn(async () => {}),
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

  it("slaat het switchen over als de chart al op het slot-timeframe staat", async () => {
    const { deps, calls } = makeDeps();
    await runSnapshotCycle(deps, ["h4"]); // chart staat al op 240
    expect(calls).toEqual(["capture:240"]); // geen set, geen herstel nodig
  });

  it("stopt vroeg en markeert needs-gesture bij een activeTab-permissiefout", async () => {
    const { deps } = makeDeps({
      captureVisible: vi.fn(async () => {
        throw new Error("Either the '<all_urls>' or 'activeTab' permission is required.");
      }),
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
    const { deps } = makeDeps({ crop: vi.fn(async () => big), upload });
    const result = await runSnapshotCycle(deps, ["d"]);
    expect(result.slots.d?.ok).toBe(false);
    expect(upload).not.toHaveBeenCalled();
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
