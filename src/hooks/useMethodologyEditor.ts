import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import { WPM_TEMPLATE_METHODOLOGY_ID } from "@/lib/constants";
import type { Methodology, MethodologyField } from "@/lib/types";

/** Editable attributes of a custom field, including its conditional visibility (show_when, cyclus 2b). */
export interface FieldInput {
  field_key: string;
  label: string;
  /** Catalogue block key for render-time label translation (0047) — set by blockToFieldInput, null for custom fields. */
  label_key: string | null;
  field_type: MethodologyField["field_type"];
  options: string[] | null;
  required: boolean;
  group_label: string | null;
  /** Catalogue group key, the group_label counterpart of label_key (0047). */
  group_key: string | null;
  /** Show this field only when show_when_field_id's value is in show_when_values; null = always. */
  show_when_field_id: string | null;
  show_when_values: string[] | null;
}

/**
 * CRUD over the active methodology's fields (Scope C, cyclus 2). System templates
 * (Weekly Phase Method) are read-only; `fork()` makes an editable personal copy and repoints
 * the profile at it (fork-on-edit). All mutations operate on the user's own
 * methodology — the UI gates editing behind `isOwn`/`fork()`.
 */
export function useMethodologyEditor() {
  const { profile, updateProfile } = useAuth();
  // The app-wide shared methodology state (MethodologyProvider) lives for the
  // whole session now — every editor mutation must push a refresh into it, or
  // the trade form/filters would keep rendering the pre-edit fields until reload.
  const { refresh: refreshShared } = useMethodology();
  const methodologyId = profile?.methodology_id ?? null;

  const [methodology, setMethodology] = useState<Methodology | null>(null);
  const [fields, setFields] = useState<MethodologyField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against a slow response from a previous journal landing after a newer
  // load and overwriting its fields (M3 — same pattern as useTrades).
  const requestIdRef = useRef(0);

  const load = useCallback(async (id: string | null) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    let mid = id;
    if (!mid) {
      // Pinned to the WPM template id — see useMethodology for why limit(1) won't do.
      const { data: sys } = await supabase
        .from("methodologies")
        .select("id")
        .eq("id", WPM_TEMPLATE_METHODOLOGY_ID)
        .maybeSingle();
      mid = (sys as { id: string } | null)?.id ?? null;
    }
    if (requestId !== requestIdRef.current) return; // superseded by a newer load
    if (!mid) {
      setMethodology(null);
      setFields([]);
      setLoading(false);
      return;
    }

    const [m, fl] = await Promise.all([
      supabase.from("methodologies").select("*").eq("id", mid).maybeSingle(),
      supabase.from("methodology_fields").select("*").eq("methodology_id", mid).order("sort_order"),
    ]);
    if (requestId !== requestIdRef.current) return; // superseded by a newer load
    if (m.error || fl.error) {
      // Keep the previous state on a flaky fetch (M7) — the editor rows would
      // otherwise vanish under the user's cursor.
      setError(toErrorMessage(m.error ?? fl.error));
      setLoading(false);
      return;
    }
    setMethodology((m.data as Methodology | null) ?? null);
    setFields((fl.data as MethodologyField[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(methodologyId);
  }, [load, methodologyId]);

  const isOwn = methodology != null && !methodology.is_system && methodology.user_id != null;

  /** Fork the active (system) template into an own editable copy and repoint the profile. */
  const fork = useCallback(async (): Promise<string> => {
    if (!methodology) throw new Error("no methodology");
    if (isOwn) return methodology.id;
    const { data, error: err } = await supabase.rpc("fork_methodology", { source_id: methodology.id });
    if (err) throw err;
    const newId = data as string;
    await updateProfile({ methodology_id: newId }); // profile change reloads via methodologyId
    return newId;
  }, [methodology, isOwn, updateProfile]);

  function requireOwn(): string {
    if (!methodology || !isOwn) throw new Error("methodology is read-only — fork first");
    return methodology.id;
  }

  const addField = useCallback(async (input: FieldInput) => {
    const mid = requireOwn();
    const nextSort = (fields.at(-1)?.sort_order ?? 0) + 1;
    const { error: err } = await supabase
      .from("methodology_fields")
      .insert({ methodology_id: mid, ...input, sort_order: nextSort });
    if (err) throw err;
    await load(mid);
    void refreshShared();
  }, [fields, load, methodology, isOwn, refreshShared]);

  const updateField = useCallback(async (id: string, patch: Partial<FieldInput>) => {
    const mid = requireOwn();
    const { error: err } = await supabase.from("methodology_fields").update(patch).eq("id", id);
    if (err) throw err;
    await load(mid);
    void refreshShared();
  }, [fields, load, methodology, isOwn, refreshShared]);

  const deleteField = useCallback(async (id: string) => {
    const mid = requireOwn();
    const { error: err } = await supabase.from("methodology_fields").delete().eq("id", id);
    if (err) throw err;
    await load(mid);
    void refreshShared();
  }, [fields, load, methodology, isOwn, refreshShared]);

  /**
   * Swap the sort_order of two fields. The grouped editor uses this to reorder a
   * field within its group (the neighbour is the previous/next field carrying the
   * same group), so a move never makes a field jump to another section.
   */
  const swapFieldOrder = useCallback(async (aId: string, bId: string) => {
    const mid = requireOwn();
    const a = fields.find((f) => f.id === aId);
    const b = fields.find((f) => f.id === bId);
    if (!a || !b) return;
    const { error: e1 } = await supabase.from("methodology_fields").update({ sort_order: b.sort_order }).eq("id", a.id);
    const { error: e2 } = await supabase.from("methodology_fields").update({ sort_order: a.sort_order }).eq("id", b.id);
    if (e1 || e2) throw (e1 ?? e2);
    await load(mid);
    void refreshShared();
  }, [fields, load, methodology, isOwn, refreshShared]);

  /** Move a field up/down by swapping sort_order with its flat neighbour. */
  const moveField = useCallback(async (id: string, direction: "up" | "down") => {
    const idx = fields.findIndex((f) => f.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= fields.length) return;
    await swapFieldOrder(fields[idx].id, fields[swapIdx].id);
  }, [fields, swapFieldOrder]);

  return { methodology, fields, isOwn, loading, error, fork, addField, updateField, deleteField, moveField, swapFieldOrder, refresh: () => load(methodologyId) };
}
