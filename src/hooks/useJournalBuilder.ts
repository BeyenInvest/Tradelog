import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import type { FieldInput } from "@/hooks/useMethodologyEditor";

/**
 * Commit for the unified journal builder (Fase G — preset redesign). Turns a
 * staged set of fields into a real own journal in one write, then activates it.
 *
 * `reuseActiveIfEmpty` handles the onboarding / empty-state case: a brand-new
 * account already owns an empty default journal, so instead of leaving that
 * orphan behind we rename it and fill it. Settings ("+ new journal") passes it
 * false and always gets a fresh journal. Either way the fields are inserted in a
 * single batch (sort_order = palette order), so partial half-built journals can't
 * appear on a flaky connection the way one-insert-per-field would allow.
 */
export interface CommitArgs {
  name: string;
  fields: FieldInput[];
  assetClass: string | null;
  instrumentConfig: Record<string, unknown> | null;
  reuseActiveIfEmpty: boolean;
}

export function useJournalBuilder() {
  const { profile, updateProfile } = useAuth();
  const { refresh: refreshShared } = useMethodology();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = useCallback(
    async ({ name, fields, assetClass, instrumentConfig, reuseActiveIfEmpty }: CommitArgs): Promise<string> => {
      if (!profile) throw new Error("no profile");
      setError(null);
      setBusy(true);
      try {
        let targetId: string | null = null;

        // Reuse the active journal only if it is the user's own and still empty.
        if (reuseActiveIfEmpty && profile.methodology_id) {
          const { data: m } = await supabase
            .from("methodologies")
            .select("id, user_id, is_system")
            .eq("id", profile.methodology_id)
            .maybeSingle();
          const row = m as { id: string; user_id: string | null; is_system: boolean } | null;
          if (row && row.user_id === profile.id && !row.is_system) {
            const { count } = await supabase
              .from("methodology_fields")
              .select("id", { count: "exact", head: true })
              .eq("methodology_id", row.id);
            if ((count ?? 0) === 0) targetId = row.id;
          }
        }

        if (targetId) {
          const { error: uErr } = await supabase
            .from("methodologies")
            .update({ naam: name, asset_class: assetClass, instrument_config: instrumentConfig })
            .eq("id", targetId);
          if (uErr) throw uErr;
        } else {
          const { data, error: cErr } = await supabase
            .from("methodologies")
            .insert({ user_id: profile.id, naam: name, is_system: false, asset_class: assetClass, instrument_config: instrumentConfig })
            .select("id")
            .single();
          if (cErr) throw cErr;
          targetId = (data as { id: string }).id;
        }

        if (fields.length > 0) {
          const rows = fields.map((f, i) => ({ methodology_id: targetId, ...f, sort_order: i + 1 }));
          const { error: fErr } = await supabase.from("methodology_fields").insert(rows);
          if (fErr) throw fErr;
        }

        if (profile.methodology_id !== targetId) {
          await updateProfile({ methodology_id: targetId });
        }
        void refreshShared();
        return targetId;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [profile, updateProfile, refreshShared]
  );

  return { commit, busy, error };
}
