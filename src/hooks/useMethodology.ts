import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { FASES } from "@/lib/constants";
import type { Methodology, MethodologyField } from "@/lib/types";

export interface MethodologyData {
  methodology: Methodology | null;
  /** All fields of the active methodology, ordered by sort_order (fase is one of them). */
  fields: MethodologyField[];
  /**
   * Ordered fase names for the UI, read from the methodology's `fase` enum field
   * (since 0023 fase is just a field). Falls back to the fixed FASES constant
   * while loading or if there is no fase field, so the form/filter never shows an
   * empty select and Archer users see no change.
   */
  faseNames: string[];
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

    // Resolve which methodology to load: the profile's, else the built-in template.
    let id = methodologyId;
    if (!id) {
      const { data: sys } = await supabase
        .from("methodologies")
        .select("id")
        .eq("is_system", true)
        .is("user_id", null)
        .limit(1)
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
    // No fase field. Only fall back to the built-in Archer fases while the
    // methodology is still loading, so the form/filter never flashes an empty
    // select. Once loaded, an own methodology with no fase field must NOT get
    // Archer's fases imposed — new users start from an empty journal
    // (Scope C, cyclus 1b plak 3).
    return loading ? [...FASES] : [];
  }, [fields, loading]);

  return { methodology, fields, faseNames, loading, error, refresh };
}
