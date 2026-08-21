import { describe, it, expect } from "vitest";
import { fetchAllPages, PAGE_SIZE } from "./fetchAll";

/** Serves `total` numbered rows the way PostgREST does: capped at PAGE_SIZE per request. */
function pagedSource(total: number) {
  const calls: Array<{ from: number; to: number }> = [];
  const page = async (from: number, to: number) => {
    calls.push({ from, to });
    const rows: number[] = [];
    for (let i = from; i <= Math.min(to, total - 1); i++) rows.push(i);
    return { data: rows, error: null };
  };
  return { page, calls };
}

describe("fetchAllPages", () => {
  it("returns a short first page as-is (the everyday small-journal case)", async () => {
    const { page, calls } = pagedSource(42);
    const { data, error } = await fetchAllPages(page);
    expect(error).toBeNull();
    expect(data).toHaveLength(42);
    expect(calls).toHaveLength(1);
  });

  it("stitches multiple pages together in order, past the 1000-row cap", async () => {
    const total = PAGE_SIZE * 2 + 345;
    const { page, calls } = pagedSource(total);
    const { data } = await fetchAllPages(page);
    expect(data).toHaveLength(total);
    // No duplicates or gaps: every row is exactly its own index.
    expect(data!.every((v, i) => v === i)).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[1]).toEqual({ from: PAGE_SIZE, to: PAGE_SIZE * 2 - 1 });
  });

  it("needs one extra (empty) request when the total is an exact page multiple", async () => {
    const { page, calls } = pagedSource(PAGE_SIZE);
    const { data } = await fetchAllPages(page);
    expect(data).toHaveLength(PAGE_SIZE);
    expect(calls).toHaveLength(2); // full page can't prove it was the last one
  });

  it("handles zero rows", async () => {
    const { page } = pagedSource(0);
    const { data, error } = await fetchAllPages(page);
    expect(data).toEqual([]);
    expect(error).toBeNull();
  });

  it("propagates an error and returns no partial data", async () => {
    const boom = { message: "boom" };
    let n = 0;
    const { data, error } = await fetchAllPages<number>(async (from, to) => {
      n++;
      if (n === 2) return { data: null, error: boom };
      return { data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null };
    });
    expect(error).toBe(boom);
    expect(data).toBeNull();
  });
});
