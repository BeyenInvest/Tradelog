import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trash2, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProjectForm } from "@/components/backtesting/ProjectForm";
import { useBacktestProjects } from "@/hooks/useBacktestProjects";
import { supabase } from "@/lib/supabase";
import { computeOutcomeCounts } from "@/lib/stats";
import { toErrorMessage } from "@/lib/errorMessage";
import type { Trade } from "@/lib/types";

/** Only the columns computeOutcomeCounts actually reads — the per-project summary cards don't need full trade rows. */
type ProjectTradeSummaryRow = Pick<Trade, "backtest_project_id" | "outcome" | "resultaat_pct">;

export default function ProjectsListPage() {
  const { t } = useTranslation();
  const { projects, loading, createProject, deleteProject } = useBacktestProjects();
  const [projectTrades, setProjectTrades] = useState<ProjectTradeSummaryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("trades")
      .select("backtest_project_id,outcome,resultaat_pct")
      .not("backtest_project_id", "is", null)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setProjectTrades((data as ProjectTradeSummaryRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [projects]);

  const summaryByProject = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeOutcomeCounts>>();
    for (const p of projects) {
      m.set(p.id, computeOutcomeCounts(projectTrades.filter((t) => t.backtest_project_id === p.id)));
    }
    return m;
  }, [projects, projectTrades]);

  async function handleDelete(id: string, naam: string) {
    if (confirm(t("backtesting.deleteConfirm", { name: naam }))) {
      setError(null);
      try {
        await deleteProject(id);
      } catch (err) {
        setError(toErrorMessage(err, t("backtesting.deleteFailed")));
      }
    }
  }

  return (
    <>
      <PageHeader title={t("nav.backtesting")} subtitle={t("backtesting.subtitle")} />

      <div className="flex flex-col gap-5">
        {error && (
          <Card className="border-loss/40">
            <p className="text-sm text-loss">{error}</p>
          </Card>
        )}

        <Card>
          <h3 className="font-display text-lg italic mb-3 text-ink">{t("backtesting.newProject")}</h3>
          <ProjectForm onSubmit={createProject} />
        </Card>

        {loading ? (
          <p className="text-muted text-sm">{t("common.loading")}</p>
        ) : projects.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">{t("backtesting.noProjects")}</p>
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
                      className="p-1.5 rounded-md hover:bg-ink/5 text-muted hover:text-loss"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 font-mono text-sm">
                    <span className="text-ink">{t("journal.tradesCount", { count: summary?.n ?? 0 })}</span>
                    {summary && summary.n > 0 && (
                      <span className={summary.resultaatTotal >= 0 ? "text-win" : "text-loss"}>
                        {summary.resultaatTotal > 0 ? "+" : ""}
                        {summary.resultaatTotal}%
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/backtesting/${p.id}`}
                    className="flex items-center justify-center gap-1.5 mt-1 px-4 py-2 rounded-lg font-body text-sm bg-surface-2 text-ink hover:bg-ink/5"
                  >
                    {t("backtesting.open")} <ChevronRight size={14} />
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
