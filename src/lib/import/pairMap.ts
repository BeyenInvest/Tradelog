import { PAIRS, type Pair } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetchAll";

// Per-user (C6): the remembered symbol→pair mapping was a single global key,
// so a second account on the same browser inherited the first's mappings.
const PAIR_MAP_STORAGE_BASE = "beyen.import.pairMap";
const pairMapKey = (userId: string) => `${PAIR_MAP_STORAGE_BASE}:${userId}`;

/** The user's remembered raw-symbol → Pair mappings (shared by the CSV import and the cTrader sync). */
export function loadStoredPairMap(userId: string): Record<string, Pair> {
  try {
    const raw = localStorage.getItem(pairMapKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const valid: Record<string, Pair> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if ((PAIRS as readonly string[]).includes(v)) valid[k] = v as Pair;
    }
    return valid;
  } catch {
    return {};
  }
}

export function storePairMap(userId: string, map: Record<string, Pair>) {
  try {
    localStorage.setItem(pairMapKey(userId), JSON.stringify(map));
  } catch {
    /* ignore quota/availability errors — mapping still works this session */
  }
}

/**
 * Every import_ref the user already has — the dedup set. Paginated (H1): above
 * 1000 imported trades a plain fetch would silently miss refs and re-import old
 * rows (the DB unique index would then abort the whole batch insert).
 */
export async function fetchExistingImportRefs(userId: string): Promise<Set<string>> {
  const { data, error } = await fetchAllPages<{ import_ref: string }>((from, to) =>
    supabase
      .from("trades")
      .select("import_ref")
      .eq("user_id", userId)
      .not("import_ref", "is", null)
      .order("id", { ascending: true })
      .range(from, to)
  );
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.import_ref));
}
