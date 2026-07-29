import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BacktestProject, BacktestProjectInput } from "@/lib/types";

export function useBacktestProjects() {
  const [projects, setProjects] = useState<BacktestProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("backtest_projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setProjects(data as BacktestProject[]);
    }
    setLoading(false);
  }, []);

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
    const { error: deleteError } = await supabase.from("backtest_projects").delete().eq("id", id);
    if (deleteError) throw deleteError;
    await refresh();
  }

  return { projects, loading, error, refresh, createProject, updateProject, deleteProject };
}
