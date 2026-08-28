/**
 * Per-user layout of the Analyse page: the order the sections are shown in and
 * which ones are collapsed. A pure, display-only preference — never a source of
 * truth — persisted in localStorage and scoped per user id so two accounts on the
 * same browser don't share it. All access is wrapped: a disabled/full localStorage
 * must never break the page (it just falls back to the default order, nothing
 * collapsed). Beta-only in the UI, but the module itself is UI-agnostic + testable.
 */

export interface AnalyseLayout {
  /** Section ids in the user's preferred order. Ids absent here fall back to their default slot (appended after the known ones). */
  order: string[];
  /** Section ids the user has collapsed. */
  collapsed: string[];
}

export const EMPTY_LAYOUT: AnalyseLayout = { order: [], collapsed: [] };

// v2: reset once because the default section order changed (kruistabel moved to sit
// just above Uitsplitsingen) — a stale saved v1 order would otherwise pin it elsewhere.
const KEY_BASE = "beyen:analyseLayout:v2";
const keyFor = (userId: string | null) => `${KEY_BASE}:${userId ?? "anon"}`;

export function readLayout(userId: string | null): AnalyseLayout {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return EMPTY_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<AnalyseLayout>;
    return {
      order: Array.isArray(parsed.order) ? parsed.order.filter((x): x is string => typeof x === "string") : [],
      collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed.filter((x): x is string => typeof x === "string") : [],
    };
  } catch {
    return EMPTY_LAYOUT;
  }
}

export function writeLayout(userId: string | null, layout: AnalyseLayout): void {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(layout));
  } catch {
    /* storage disabled/full — remembering the layout is best-effort */
  }
}

/**
 * Whether this user has ever saved a layout. Distinguishes a genuine first visit
 * (apply the default-collapsed layout — only the overview + equity open) from a
 * user who has interacted and happens to have nothing collapsed. A read failure
 * (storage disabled) reports false, so those users get the sensible default too.
 */
export function hasStoredLayout(userId: string | null): boolean {
  try {
    return localStorage.getItem(keyFor(userId)) != null;
  } catch {
    return false;
  }
}

/** Forgets the saved layout entirely (reset → back to the first-visit default). */
export function clearLayout(userId: string | null): void {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    /* storage disabled — nothing to clear */
  }
}

/**
 * The effective display order for the currently-visible sections: the saved order
 * first (minus ids no longer present), then any remaining default ids in their
 * default relative order. So a newly-added section shows up (at the end) instead of
 * vanishing, and a section that isn't visible in this context is simply skipped.
 */
export function applyOrder(defaultIds: string[], savedOrder: string[]): string[] {
  const known = savedOrder.filter((id) => defaultIds.includes(id));
  const rest = defaultIds.filter((id) => !known.includes(id));
  return [...known, ...rest];
}

/** Moves `fromId` to sit just before `toId`, returning a new array. No-op if either id is missing or they're equal. */
export function moveId(ids: string[], fromId: string, toId: string): string[] {
  if (fromId === toId || !ids.includes(fromId) || !ids.includes(toId)) return ids;
  const without = ids.filter((id) => id !== fromId);
  const target = without.indexOf(toId);
  without.splice(target, 0, fromId);
  return without;
}

/** Toggles membership of `id` in a list (add if absent, remove if present). */
export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
