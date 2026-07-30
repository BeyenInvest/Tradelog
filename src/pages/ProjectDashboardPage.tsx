import { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, Trash2, Pencil } from "lucide-react";
import { TradeJournalView } from "@/components/trades/TradeJournalView";
import { BacktestingAnalysisView } from "@/components/backtesting/BacktestingAnalysisView";
import { ProjectForm } from "@/components/backtesting/ProjectForm";
import { useBacktestProjects } from "@/hooks/useBacktestProjects";
import { useTrades } from "@/hooks/useTrades";
import { toErrorMessage } from "@/lib/errorMessage";

export default function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, loading: projectsLoading, updateProject, deleteProject } = useBacktestProjects();
  const [tab, setTab] = useState<"journal" | "analyse">("journal");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const project = projects.find((p) => p.id === projectId);
  // One shared instance for both tabs — see TradesApi. Two would leave Analyse stale after adding a trade.
  const tradesApi = useTrades(projectId ? { type: "project", projectId } : { type: "live" });
  const analysisTrades = tradesApi.trades;

  if (!projectId) return <Navigate to="/backtesting" replace />;
  if (projectsLoading) return <p className="text-muted text-sm">Laden...</p>;
  if (!project) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Project niet gevonden.</p>
        <Link to="/backtesting" className="text-sm text-gold w-fit">
          &larr; Terug naar projecten
        </Link>
      </div>
    );
  }

  async function handleDelete() {
    if (confirm(`Project "${project!.naam}" en al zijn trades definitief verwijderen?`)) {
      setError(null);
      try {
        await deleteProject(project!.id);
        window.location.href = "/backtesting";
      } catch (err) {
        setError(toErrorMessage(err, "Verwijderen van project is mislukt"));
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Link to="/backtesting" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink w-fit">
          <ArrowLeft size={14} /> Projecten
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing((v) => !v)} className="p-1.5 rounded-md hover:bg-white/5 text-muted hover:text-ink">
            <Pencil size={14} />
          </button>
          <button onClick={() => void handleDelete()} className="p-1.5 rounded-md hover:bg-white/5 text-muted hover:text-loss">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      {editing ? (
        <ProjectForm
          project={project}
          onSubmit={async (input) => {
            await updateProject(project.id, input);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div>
          <h1 className="font-display text-3xl italic text-ink">{project.naam}</h1>
          {project.beschrijving && <p className="font-mono text-xs mt-1 text-muted">{project.beschrijving}</p>}
        </div>
      )}

      <div className="inline-flex rounded-lg border border-border overflow-hidden w-fit">
        <button
          onClick={() => setTab("journal")}
          className={`px-4 py-2 text-sm font-body ${tab === "journal" ? "bg-gold text-bg" : "bg-surface-2 text-muted"}`}
        >
          Journal
        </button>
        <button
          onClick={() => setTab("analyse")}
          className={`px-4 py-2 text-sm font-body ${tab === "analyse" ? "bg-gold text-bg" : "bg-surface-2 text-muted"}`}
        >
          Analyse
        </button>
      </div>

      {tab === "journal" ? (
        <TradeJournalView
          scope={{ type: "project", projectId: project.id }}
          tradesApi={tradesApi}
          title={project.naam}
          subtitle={`${analysisTrades.length} trades in dit project`}
        />
      ) : (
        <BacktestingAnalysisView trades={analysisTrades} />
      )}
    </div>
  );
}
