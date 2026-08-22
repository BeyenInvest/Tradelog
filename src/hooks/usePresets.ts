import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";

/** A ready-made journal template (is_system methodology) shown in the picker. */
export interface PresetSummary {
  id: string;
  naam: string;
  asset_class: string | null;
  /** Field labels in sort order — a short preview of what the recipe tracks. */
  fieldLabels: string[];
}

/**
 * Loads the world-readable journal presets (is_system methodologies + a preview of
 * their fields) for the "Start from a template" picker (Scope C, cyclus 6), and
 * applies a choice: `applyPreset` forks a preset into an editable own copy and
 * repoints the profile (reusing the fork_methodology RPC, 0024); `createBlank`
 * makes an empty own journal. Both switch the active journal via updateProfile,
 * which reloads useMethodology / useMethodologyEditor downstream.
 */
export function usePresets() {
  const { t } = useTranslation();
  const { profile, updateProfile } = useAuth();
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: meths, error: mErr } = await supabase
      .from("methodologies")
      .select("id, naam, asset_class")
      .eq("is_system", true)
      .is("user_id", null)
      .order("naam");
    if (mErr) {
      setError(toErrorMessage(mErr));
      setLoading(false);
      return;
    }

    const rows = (meths as { id: string; naam: string; asset_class: string | null }[] | null) ?? [];
    const ids = rows.map((m) => m.id);
    const labelsByMeth = new Map<string, string[]>();

    if (ids.length > 0) {
      const { data: fields, error: fErr } = await supabase
        .from("methodology_fields")
        .select("methodology_id, label, sort_order")
        .in("methodology_id", ids)
        .order("sort_order");
      if (fErr) {
        setError(toErrorMessage(fErr));
        setLoading(false);
        return;
      }
      for (const f of (fields as { methodology_id: string; label: string }[] | null) ?? []) {
        const arr = labelsByMeth.get(f.methodology_id) ?? [];
        arr.push(f.label);
        labelsByMeth.set(f.methodology_id, arr);
      }
    }

    setPresets(
      rows.map((m) => ({
        id: m.id,
        naam: m.naam,
        asset_class: m.asset_class,
        fieldLabels: labelsByMeth.get(m.id) ?? [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Fork a preset into an editable own copy and make it the active journal. */
  const applyPreset = useCallback(
    async (sourceId: string) => {
      const { data, error: err } = await supabase.rpc("fork_methodology", { source_id: sourceId });
      if (err) throw err;
      await updateProfile({ methodology_id: data as string });
    },
    [updateProfile]
  );

  /** Create a fresh empty own journal (the "Blanco" choice) and make it active. */
  const createBlank = useCallback(async () => {
    if (!profile) throw new Error("no profile");
    // Localized: the stored name is what the switcher shows for the life of the
    // journal (there's no rename UI yet), so it must match the UI language.
    const { data, error: err } = await supabase
      .from("methodologies")
      .insert({ user_id: profile.id, naam: t("presets.blankJournalName"), is_system: false, asset_class: null })
      .select("id")
      .single();
    if (err) throw err;
    await updateProfile({ methodology_id: (data as { id: string }).id });
  }, [profile, updateProfile, t]);

  return { presets, loading, error, applyPreset, createBlank, activeId: profile?.methodology_id ?? null };
}
