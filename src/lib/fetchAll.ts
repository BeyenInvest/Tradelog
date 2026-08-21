/**
 * Paginated "fetch everything" loop around PostgREST's silent row cap (audit
 * blocker H1). Supabase caps every read at max-rows = 1000 — a plain
 * `.select("*")` on a journal with 1.200 trades silently returns the first
 * 1.000 and every stat computed from it is wrong. No error, no warning.
 *
 * Callers pass a page factory that builds a FRESH query per page (PostgREST
 * builders are single-use) and applies `.range(from, to)` to it. The loop keeps
 * requesting pages of PAGE_SIZE until a short page signals the end.
 *
 * Two contract points, both load-bearing:
 *  - The query MUST have a deterministic total order (add `.order("id")` as a
 *    tie-breaker after any non-unique sort column) — otherwise rows can shuffle
 *    across page boundaries and get duplicated/dropped.
 *  - PAGE_SIZE must not exceed the server's max-rows (1000): a server that
 *    returns fewer rows than requested reads as "last page".
 */

export const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const all: T[] = [];
  for (;;) {
    const { data, error } = await page(all.length, all.length + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return { data: all, error: null };
  }
}
