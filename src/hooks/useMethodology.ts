import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { FASES, WPM_TEMPLATE_METHODOLOGY_ID } from "@/lib/constants";
import type { Methodology, MethodologyField } from "@/lib/types";

export interface MethodologyData {
  methodology: Methodology | null;
  /** All fields of the active methodology, ordered by sort_order (fase is one of them). */
  fields: MethodologyField[];
  /**
   * Ordered fase names for the UI, read from the methodology's `fase` enum field
   * (since 0023 fase is just a field). Falls back to the fixed FASES constant
   * while loading or if there is no fase field, so the form/filter never shows an
   * empty select and Weekly Phase Method users see no change.
   */
  faseNames: string[];
  /**
   * True when the active methodology still carries the legacy hardcoded Weekly
   * Phase Method block (the fase <select> + fase-kenmerken + confirms/entry/cc/…,
   * backed by real trades.* columns). The trade form gates that whole hardcoded
   * block on this, so an own/empty journal shows only the universal core + its
   * own custom fields (Scope C, optie A). Signalled by the presence of a `fase`
   * enum field — the Weekly Phase Method template and its forks have one; an
   * empty own methodology does not. Stays true while loading so the owner's WPM
   * fields never flash out on open (an empty journal is forward-looking — public
   * signup is still off).
   */
  isLegacyMethodology: boolean;
  /**
   * True when the active journal trades forex (asset_class 'forex' — the Weekly
   * Phase Method template/forks and the Forex presets). Drives the instrument
   * field (pair enum vs free text) and the forex-only breakdowns (pair/currency)
   * / lot calculator (cyclus 7). Stays true while loading so a forex owner never
   * sees the field flip. A blank/own or non-forex journal is false.
   */
  isForexJournal: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads the signed-in user's active methodology (profiles.methodology_id, or the
 * built-in system template as a fallback) with its fields. Read-only source of
 * truth for the fase list — replaces the hard-coded FASES constant in the trade
 * form and filters (Scope C, cyclus 1). Since plak 2b the fase list comes from
 * the `fase` field, not the (now-transitional) methodology_fases table.
 */
export function useMethodology(): MethodologyData {
  const { profile } = useAuth();
  const methodologyId = profile?.methodology_id ?? null;

  const [methodology, setMethodology] = useState<Methodology | null>(null);
  const [fields, setFields] = useState<MethodologyField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Resolve which methodology to load: the profile's, else the built-in Weekly
    // Phase Method template — pinned by id, since the preset catalogue (0027/0028)
    // added many is_system rows and an unordered limit(1) would pick arbitrarily.
    let id = methodologyId;
    if (!id) {
      const { data: sys } = await supabase
        .from("methodologies")
        .select("id")
        .eq("id", WPM_TEMPLATE_METHODOLOGY_ID)
        .maybeSingle();
      id = (sys as { id: string } | null)?.id ?? null;
    }

    if (!id) {
      setMethodology(null);
      setFields([]);
      setLoading(false);
      return;
    }

    const [m, fl] = await Promise.all([
      supabase.from("methodologies").select("*").eq("id", id).maybeSingle(),
      supabase.from("methodology_fields").select("*").eq("methodology_id", id).order("sort_order"),
    ]);

    const err = m.error ?? fl.error;
    if (err) setError(err.message);

    setMethodology((m.data as Methodology | null) ?? null);
    setFields((fl.data as MethodologyField[] | null) ?? []);
    setLoading(false);
  }, [methodologyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const faseNames = useMemo(() => {
    const faseField = fields.find((f) => f.field_key === "fase" && f.field_type === "enum");
    const opts = faseField?.options ?? [];
    if (opts.length > 0) return opts;
    // No fase field. Only fall back to the built-in Weekly Phase Method fases while the
    // methodology is still loading, so the form/filter never flashes an empty
    // select. Once loaded, an own methodology with no fase field must NOT get
    // Weekly Phase Method's fases imposed — new users start from an empty journal
    // (Scope C, cyclus 1b plak 3).
    return loading ? [...FASES] : [];
  }, [fields, loading]);

  const isLegacyMethodology = useMemo(
    () => loading || fields.some((f) => f.field_key === "fase"),
    [fields, loading]
  );

  // Forex while loading so a forex owner's pair select never flips to a free field on open.
  const isForexJournal = useMemo(
    () => loading || methodology?.asset_class === "forex",
    [loading, methodology]
  );

  return { methodology, fields, faseNames, isLegacyMethodology, isForexJournal, loading, error, refresh };
}
