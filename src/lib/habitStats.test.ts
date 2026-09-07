import { describe, it, expect } from "vitest";
import {
  isoDaysBetween,
  dailyAdherenceLastN,
  floorAdherenceLastN,
  bestFloorStreakLastN,
  recentWeekSummaries,
  monthSummary,
  type DaysByDate,
} from "@/lib/habitStats";
import type { HabitValues } from "@/lib/habits";

function make(entries: Record<string, HabitValues>): DaysByDate {
  return new Map(Object.entries(entries));
}
const floor: HabitValues = { keystone: true, journal: true };

describe("isoDaysBetween", () => {
  it("is inclusive of both ends", () => {
    expect(isoDaysBetween("2026-09-07", "2026-09-09")).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
  });
  it("returns a single day when start == end", () => {
    expect(isoDaysBetween("2026-09-07", "2026-09-07")).toEqual(["2026-09-07"]);
  });
  it("returns empty when start > end", () => {
    expect(isoDaysBetween("2026-09-09", "2026-09-07")).toEqual([]);
  });
  it("crosses a month boundary", () => {
    expect(isoDaysBetween("2026-09-30", "2026-10-02")).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("floorAdherenceLastN", () => {
  it("counts only floor-met days in the window", () => {
    const days = make({
      "2026-09-07": floor,
      "2026-09-08": { keystone: true }, // journal missing → not floor
      "2026-09-09": floor,
    });
    const a = floorAdherenceLastN(days, "2026-09-09", 3);
    expect(a).toMatchObject({ done: 2, total: 3 });
    expect(a.rate).toBeCloseTo(2 / 3);
  });
  it("is zero on an empty history", () => {
    expect(floorAdherenceLastN(make({}), "2026-09-09", 30)).toMatchObject({ done: 0, total: 30, rate: 0 });
  });
});

describe("dailyAdherenceLastN", () => {
  it("reports per-habit done counts", () => {
    const days = make({
      "2026-09-08": { keystone: true, journal: true, water: true },
      "2026-09-09": { keystone: true, stappen: true },
    });
    const byKey = Object.fromEntries(dailyAdherenceLastN(days, "2026-09-09", 2).map((a) => [a.key, a.done]));
    expect(byKey.keystone).toBe(2);
    expect(byKey.journal).toBe(1);
    expect(byKey.water).toBe(1);
    expect(byKey.stappen).toBe(1);
    expect(byKey.zoon).toBe(0);
  });
});

describe("bestFloorStreakLastN", () => {
  it("finds the longest consecutive floor run, not the current one", () => {
    const days = make({
      "2026-09-01": floor,
      "2026-09-02": floor,
      "2026-09-03": floor, // run of 3
      "2026-09-04": {}, // break
      "2026-09-05": floor, // run of 1 (current)
    });
    expect(bestFloorStreakLastN(days, "2026-09-05", 5)).toBe(3);
  });
});

describe("recentWeekSummaries", () => {
  it("returns the requested number of weeks, oldest first, including the current week", () => {
    // 2026-09-09 is a Wednesday → ISO week 37 of 2026.
    const weeks = recentWeekSummaries(make({}), "2026-09-09", 4);
    expect(weeks).toHaveLength(4);
    expect(weeks[3].week).toBe(37); // last = current
    expect(weeks[0].week).toBe(34); // oldest = 3 weeks back
    // Ordered ascending.
    expect(weeks.map((w) => w.week)).toEqual([34, 35, 36, 37]);
  });
  it("caps the current week's counted days at today (Mon→Wed = 3)", () => {
    const cur = recentWeekSummaries(make({}), "2026-09-09", 1)[0];
    expect(cur.daysCounted).toBe(3);
  });
  it("counts a full past week as 7 days", () => {
    const weeks = recentWeekSummaries(make({}), "2026-09-09", 4);
    expect(weeks[0].daysCounted).toBe(7);
  });
  it("tallies floor, keystone and weekly-target counts within the week", () => {
    const days = make({
      "2026-09-07": { keystone: true, journal: true, sport: true }, // Mon: floor + sport
      "2026-09-08": { keystone: true, sport: true }, // Tue: keystone only + sport
      "2026-09-09": { keystone: true, journal: true }, // Wed: floor
    });
    const cur = recentWeekSummaries(days, "2026-09-09", 1)[0];
    expect(cur.floorDays).toBe(2);
    expect(cur.keystoneDays).toBe(3);
    const sport = cur.weekly.find((w) => w.key === "sport")!;
    expect(sport).toMatchObject({ count: 2, target: 3, reached: false });
  });
});

describe("monthSummary", () => {
  it("counts only up to today for the current month", () => {
    const days = make({
      "2026-09-01": floor,
      "2026-09-05": floor,
      "2026-09-09": floor,
      "2026-09-15": floor, // in the future relative to today → must NOT count
    });
    const m = monthSummary(days, 2026, 8 /* September */, "2026-09-09");
    expect(m.daysCounted).toBe(9); // 1..9
    expect(m.floorDays).toBe(3); // the 15th excluded
    expect(m.lastCountedIso).toBe("2026-09-09");
  });
  it("counts the whole month for a past month", () => {
    const m = monthSummary(make({}), 2026, 7 /* August, 31 days */, "2026-09-09");
    expect(m.daysCounted).toBe(31);
    expect(m.lastCountedIso).toBe("2026-08-31");
  });
});
