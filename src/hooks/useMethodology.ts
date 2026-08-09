import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { FASES } from "@/lib/constants";
import type { Methodology, MethodologyFase, MethodologyField } from "@/lib/types";

export interface MethodologyData {
  methodology: Methodology | null;
  /** Fases of the active methodology, ordered by sort_order. */
  fases: MethodologyFase[];
  /** All kenmerk-fields of the active methodology (used from cyclus 2 on). */
  fields: MethodologyField[];
  /**
   * Ordered fase names for the UI. Falls back to the fixed FASES constant while
   * loading or if the methodology has no fases, so the form/filter never shows an
   * empty select and Archer users see no change.
   */
  faseNames: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads the signed-in user's active methodology (profiles.methodology_id, or the
 * built-in system template as a fallback) with its fases and kenmerk-fields.
 * Read-only source of truth for the fase list — replaces the hard-coded FASES
 * constant in the trade form and filters (Scope C, cyclus 1).
 */
export function useMethodology(): MethodologyData {
  const { profile } = useAuth();
  const methodologyId = profile?.methodology_id ?? null;

  const [methodology, setMethodology] = useState<Methodology | null>(null);
  const [fases, setFases] = useState<MethodologyFase[]>([]);
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
      setFases([]);
      setFields([]);
      setLoading(false);
      return;
    }

    const [m, fs, fl] = await Promise.all([
      supabase.from("methodologies").select("*").eq("id", id).maybeSingle(),
      supabase.from("methodology_fases").select("*").eq("methodology_id", id).order("sort_order"),
      supabase.from("methodology_fields").select("*").eq("methodology_id", id).order("sort_order"),
    ]);

    const err = m.error ?? fs.error ?? fl.error;
    if (err) setError(err.message);

    setMethodology((m.data as Methodology | null) ?? null);
    setFases((fs.data as MethodologyFase[] | null) ?? []);
    setFields((fl.data as MethodologyField[] | null) ?? []);
    setLoading(false);
  }, [methodologyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const faseNames = useMemo(
    () => (fases.length > 0 ? fases.map((f) => f.naam) : [...FASES]),
    [fases]
  );

  return { methodology, fases, fields, faseNames, loading, error, refresh };
}
