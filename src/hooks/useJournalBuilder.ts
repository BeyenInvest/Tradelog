import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import type { FieldInput } from "@/hooks/useMethodologyEditor";

/**
 * Commit for the unified journal builder (Fase G — preset redesign). Turns a
 * staged set of fields into a real own journal and activates it, in ONE
 * transaction: the create_journal RPC (0052) does journal + fields + profile
 * activation server-side, so a network failure can no longer leave an orphan
 * half-journal in the switcher, and a retry can't duplicate it (audit M4-a).
 *
 * `reuseActiveIfEmpty` handles the onboarding / empty-state case: a brand-new
 * account already owns an empty default journal, so instead of leaving that
 * orphan behind the RPC renames and fills it. Settings ("+ new journal") passes
 * it false and always gets a fresh journal.
 */
export interface CommitArgs {
  name: string;
  fields: FieldInput[];
  assetClass: string | null;
  instrumentConfig: Record<string, unknown> | null;
  /** Opt-in for the advanced-analysis layer (0050): planned R:R + MAE/MFE + SQN. Default off. */
  trackExit: boolean;
  reuseActiveIfEmpty: boolean;
}

export function useJournalBuilder() {
  const { profile, retryProfile } = useAuth();
  const { refresh: refreshShared } = useMethodology();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = useCallback(
    async ({ name, fields, assetClass, instrumentConfig, trackExit, reuseActiveIfEmpty }: CommitArgs): Promise<string> => {
      if (!profile) throw new Error("no profile");
      setError(null);
      setBusy(true);
      try {
        // One transaction server-side (reuse-or-create + fields + activation) —
        // see 0052 for the reuse rule and the RLS reasoning.
        const { data, error: rpcErr } = await supabase.rpc("create_journal", {
          p_name: name,
          p_fields: fields,
          p_asset_class: assetClass,
          p_instrument_config: instrumentConfig,
          p_track_exit: trackExit,
          p_reuse_active_if_empty: reuseActiveIfEmpty,
        });
        if (rpcErr) throw rpcErr;
        const targetId = data as string;
        // The RPC already flipped profiles.methodology_id — refetch so the local
        // auth state (active journal) catches up before callers navigate on.
        await retryProfile();
        void refreshShared();
        return targetId;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [profile, retryProfile, refreshShared]
  );

  return { commit, busy, error };
}
