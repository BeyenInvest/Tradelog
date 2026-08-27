import { describe, it, expect, vi, afterEach } from "vitest";
import { toLocalIso, localTodayIso } from "@/lib/localDate";

afterEach(() => {
  vi.useRealTimers();
});

describe("toLocalIso", () => {
  it("formats the LOCAL calendar date with zero-padded month/day", () => {
    expect(toLocalIso(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toLocalIso(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("keeps the local day just after local midnight — the toISOString pitfall (M2)", () => {
    // For any zone ahead of UTC (CET/CEST), toISOString().slice(0,10) on 00:30
    // local yields YESTERDAY; the local getters must not.
    expect(toLocalIso(new Date(2026, 7, 27, 0, 30))).toBe("2026-08-27");
  });

  it("keeps the local day just before midnight", () => {
    expect(toLocalIso(new Date(2026, 7, 27, 23, 59, 59))).toBe("2026-08-27");
  });

  it("year boundary: Jan 1 shortly after local midnight stays Jan 1", () => {
    expect(toLocalIso(new Date(2027, 0, 1, 0, 5))).toBe("2027-01-01");
  });
});

describe("localTodayIso", () => {
  it("is evaluated at call time, not module load — a day-spanning PWA tab moves along (M2)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 27, 0, 30));
    expect(localTodayIso()).toBe("2026-08-27");
    vi.setSystemTime(new Date(2026, 7, 28, 12, 0));
    expect(localTodayIso()).toBe("2026-08-28");
  });
});
