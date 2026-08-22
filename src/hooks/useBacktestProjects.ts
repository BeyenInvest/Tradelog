import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { removeScreenshots, screenshotStoragePaths } from "@/lib/storage/screenshots";
import { useAuth } from "@/hooks/useAuth";
import type { BacktestProject, BacktestProjectInput } from "@/lib/types";

export function useBacktestProjects() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [projects, setProjects] = useState<BacktestProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Explicit user_id filter — see useTrades for why this can't be left to RLS alone.
    const { data, error: fetchError } = await supabase
      .from("backtest_projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (fetchError) {
      setError(toErrorMessage(fetchError));
    } else {
      setProjects(data as BacktestProject[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createProject(input: BacktestProjectInput): Promise<BacktestProject> {
    const { data, error: insertError } = await supabase.from("backtest_projects").insert(input).select().single();
    if (insertError) throw insertError;
    await refresh();
    return data as BacktestProject;
  }

  async function updateProject(id: string, input: Partial<BacktestProjectInput>): Promise<BacktestProject> {
    const { data, error: updateError } = await supabase
      .from("backtest_projects")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (updateError) throw updateError;
    await refresh();
    return data as BacktestProject;
  }

  /** Cascades: deletes the project's trades too (schema FK is ON DELETE CASCADE) — projects are isolated sandboxes. */
  async function deleteProject(id: string): Promise<void> {
    // The DB cascade removes the trades but not their uploaded screenshots
    // (N2-lifecycle) — collect those paths before the rows are gone. A failed
    // lookup doesn't block the delete: the files then wait for account deletion.
    const { data: rows } = await supabase
      .from("trades")
      .select("w_screenshot, d_screenshot, h4_screenshot, h2_screenshot")
      .eq("backtest_project_id", id);
    const { error: deleteError } = await supabase.from("backtest_projects").delete().eq("id", id);
    if (deleteError) throw deleteError;
    void removeScreenshots((rows ?? []).flatMap(screenshotStoragePaths));
    await refresh();
  }

  return { projects, loading, error, refresh, createProject, updateProject, deleteProject };
}
