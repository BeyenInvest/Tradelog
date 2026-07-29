import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProjectForm } from "@/components/backtesting/ProjectForm";
import { useBacktestProjects } from "@/hooks/useBacktestProjects";
import { supabase } from "@/lib/supabase";
import { computeOutcomeCounts } from "@/lib/stats";
import type { Trade } from "@/lib/types";

export default function ProjectsListPage() {
  const { projects, loading, createProject, deleteProject } = useBacktestProjects();
  const [projectTrades, setProjectTrades] = useState<Trade[]>([]);

  useEffect(() => {
    supabase
      .from("trades")
      .select("*")
      .not("backtest_project_id", "is", null)
      .then(({ data }) => setProjectTrades((data as Trade[]) ?? []));
  }, [projects.length]);

  const summaryByProject = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeOutcomeCounts>>();
    for (const p of projects) {
      m.set(p.id, computeOutcomeCounts(projectTrades.filter((t) => t.backtest_project_id === p.id)));
    }
    return m;
  }, [projects, projectTrades]);

  async function handleDelete(id: string, naam: string) {
    if (confirm(`Project "${naam}" en al zijn trades definitief verwijderen?`)) {
      await deleteProject(id);
    }
  }

  return (
    <>
      <PageHeader title="Backtesting" subtitle="Elk project is een volledig geïsoleerde testomgeving — eigen trades, eigen journal, eigen analyse" />

      <div className="flex flex-col gap-5">
        <Card>
          <h3 className="font-display text-lg italic mb-3 text-ink">Nieuw project</h3>
          <ProjectForm onSubmit={createProject} />
        </Card>

        {loading ? (
          <p className="text-muted text-sm">Laden...</p>
        ) : projects.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Nog geen backtestprojecten.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {projects.map((p) => {
              const summary = summaryByProject.get(p.id);
              return (
                <Card key={p.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display text-xl italic text-ink">{p.naam}</p>
                      {p.beschrijving && <p className="font-body text-xs text-muted mt-1">{p.beschrijving}</p>}
                    </div>
                    <button
                      onClick={() => void handleDelete(p.id, p.naam)}
                      className="p-1.5 rounded-md hover:bg-white/5 text-muted hover:text-loss"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 font-mono text-sm">
                    <span className="text-ink">{summary?.n ?? 0} trades</span>
                    {summary && summary.n > 0 && (
                      <span className={summary.resultaatTotal >= 0 ? "text-win" : "text-loss"}>
                        {summary.resultaatTotal > 0 ? "+" : ""}
                        {summary.resultaatTotal}%
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/backtesting/${p.id}`}
                    className="flex items-center justify-center gap-1.5 mt-1 px-4 py-2 rounded-lg font-body text-sm bg-surface-2 text-ink hover:bg-white/5"
                  >
                    Openen <ChevronRight size={14} />
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
