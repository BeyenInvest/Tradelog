import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { WPM_TEMPLATE_METHODOLOGY_ID } from "@/lib/constants";
import { allDefaultSections, builtinKeysFor, slugifySectionKey } from "@/lib/reviewSections";
import type { Methodology, ReviewKind, ReviewSectionInputType, ReviewSectionRow } from "@/lib/types";

/** The editable attributes of a review section. */
export interface ReviewSectionInput {
  section_key: string;
  label: string;
  /** Catalogue key for render-time translation; null for a user-renamed/custom section. */
  label_key: string | null;
  input_type: ReviewSectionInputType;
}

/**
 * CRUD over the active journal's review_sections (Fase N5) — the review-side
 * counterpart of useMethodologyEditor. A system template is read-only until the
 * user forks an editable copy (fork-on-edit, shared with the field editor via the
 * same fork_methodology RPC + profile repoint).
 *
 * A journal starts with *no* rows and falls back to the built-in defaults
 * everywhere. `customize(kind)` materializes those defaults into editable rows so
 * the user can rename/reorder/add/remove; `resetToDefaults(kind)` drops them again.
 */
export function useReviewSectionsEditor() {
  const { profile, updateProfile } = useAuth();
  const methodologyId = profile?.methodology_id ?? null;

  const [methodology, setMethodology] = useState<Methodology | null>(null);
  const [sections, setSections] = useState<ReviewSectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (id: string | null) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    let mid = id;
    if (!mid) {
      const { data: sys } = await supabase
        .from("methodologies")
        .select("id")
        .eq("id", WPM_TEMPLATE_METHODOLOGY_ID)
        .maybeSingle();
      mid = (sys as { id: string } | null)?.id ?? null;
    }
    if (requestId !== requestIdRef.current) return;
    if (!mid) {
      setMethodology(null);
      setSections([]);
      setLoading(false);
      return;
    }

    const [m, s] = await Promise.all([
      supabase.from("methodologies").select("*").eq("id", mid).maybeSingle(),
      supabase.from("review_sections").select("*").eq("methodology_id", mid).order("sort_order"),
    ]);
    if (requestId !== requestIdRef.current) return;
    if (m.error || s.error) {
      setError(toErrorMessage(m.error ?? s.error));
      setLoading(false);
      return;
    }
    setMethodology((m.data as Methodology | null) ?? null);
    setSections((s.data as ReviewSectionRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(methodologyId);
  }, [load, methodologyId]);

  const isOwn = methodology != null && !methodology.is_system && methodology.user_id != null;

  const fork = useCallback(async (): Promise<string> => {
    if (!methodology) throw new Error("no methodology");
    if (isOwn) return methodology.id;
    const { data, error: err } = await supabase.rpc("fork_methodology", { source_id: methodology.id });
    if (err) throw err;
    const newId = data as string;
    await updateProfile({ methodology_id: newId });
    return newId;
  }, [methodology, isOwn, updateProfile]);

  function requireOwn(): string {
    if (!methodology || !isOwn) throw new Error("methodology is read-only — fork first");
    return methodology.id;
  }

  const sectionsOf = useCallback((kind: ReviewKind) => sections.filter((s) => s.review_kind === kind), [sections]);

  /** Materialize the built-in defaults for a kind into editable rows (idempotent — no-op if rows already exist). */
  const customize = useCallback(async (kind: ReviewKind) => {
    const mid = requireOwn();
    if (sections.some((s) => s.review_kind === kind)) return;
    const rows = allDefaultSections(kind).map((s, i) => ({
      methodology_id: mid,
      review_kind: kind,
      section_key: s.key,
      // Persist the current wording as a fallback, but keep the catalogue key so
      // untouched defaults keep following the UI language (0047-style).
      label: s.labelKey ?? s.key,
      label_key: s.labelKey,
      input_type: s.inputType,
      sort_order: i,
    }));
    const { error: err } = await supabase.from("review_sections").insert(rows);
    if (err) throw err;
    await load(mid);
  }, [sections, load, methodology, isOwn]);

  /** Drop all custom rows for a kind — the journal reverts to the built-in default set. */
  const resetToDefaults = useCallback(async (kind: ReviewKind) => {
    const mid = requireOwn();
    const { error: err } = await supabase.from("review_sections").delete().eq("methodology_id", mid).eq("review_kind", kind);
    if (err) throw err;
    await load(mid);
  }, [load, methodology, isOwn]);

  const addSection = useCallback(async (kind: ReviewKind, input: Pick<ReviewSectionInput, "label" | "input_type">) => {
    const mid = requireOwn();
    const own = sections.filter((s) => s.review_kind === kind);
    const nextSort = (own.at(-1)?.sort_order ?? -1) + 1;
    const { error: err } = await supabase.from("review_sections").insert({
      methodology_id: mid,
      review_kind: kind,
      section_key: slugifySectionKey(input.label),
      label: input.label.trim(),
      label_key: null, // a hand-made section is free text — no catalogue translation
      input_type: input.input_type,
      sort_order: nextSort,
    });
    if (err) throw err;
    await load(mid);
  }, [sections, load, methodology, isOwn]);

  const updateSection = useCallback(async (id: string, patch: Partial<ReviewSectionInput>) => {
    const mid = requireOwn();
    // Renaming a section makes it the user's own wording — clear the catalogue key
    // so their label always wins (the review-side counterpart of the 0047 trigger).
    const body = "label" in patch ? { ...patch, label_key: null } : patch;
    const { error: err } = await supabase.from("review_sections").update(body).eq("id", id);
    if (err) throw err;
    await load(mid);
  }, [load, methodology, isOwn]);

  const deleteSection = useCallback(async (id: string) => {
    const mid = requireOwn();
    const { error: err } = await supabase.from("review_sections").delete().eq("id", id);
    if (err) throw err;
    await load(mid);
  }, [load, methodology, isOwn]);

  /** Move a section up/down within its own kind by swapping sort_order with its neighbour. */
  const moveSection = useCallback(async (id: string, direction: "up" | "down") => {
    const mid = requireOwn();
    const target = sections.find((s) => s.id === id);
    if (!target) return;
    const siblings = sections.filter((s) => s.review_kind === target.review_kind).sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((s) => s.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx];
    const b = siblings[swapIdx];
    const { error: e1 } = await supabase.from("review_sections").update({ sort_order: b.sort_order }).eq("id", a.id);
    const { error: e2 } = await supabase.from("review_sections").update({ sort_order: a.sort_order }).eq("id", b.id);
    if (e1 || e2) throw (e1 ?? e2);
    await load(mid);
  }, [sections, load, methodology, isOwn]);

  /** Keys not allowed for a new custom section in a kind: built-in columns + already-used keys. */
  const usedKeys = useCallback(
    (kind: ReviewKind) => new Set<string>([...builtinKeysFor(kind), ...sections.filter((s) => s.review_kind === kind).map((s) => s.section_key)]),
    [sections]
  );

  return {
    methodology,
    sections,
    sectionsOf,
    isOwn,
    loading,
    error,
    fork,
    customize,
    resetToDefaults,
    addSection,
    updateSection,
    deleteSection,
    moveSection,
    usedKeys,
    refresh: () => load(methodologyId),
  };
}
