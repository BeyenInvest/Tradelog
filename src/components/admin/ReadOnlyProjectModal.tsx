import { useState } from "react";
import { X } from "lucide-react";
import { useModalGuard } from "@/hooks/useModalGuard";
import { ReadOnlyTradesViewer } from "@/components/admin/ReadOnlyTradesViewer";
import { BacktestingAnalysisView } from "@/components/backtesting/BacktestingAnalysisView";
import type { BacktestProject, Trade } from "@/lib/types";

/** Read-only equivalent of ProjectDashboardPage — Journal/Analyse tabs over a project's trades, for the admin debug view. */
export function ReadOnlyProjectModal({
  project, trades, hideFaseOverride, onClose,
}: {
  project: BacktestProject;
  trades: Trade[];
  /** The viewed profile's own hide_fase — see BacktestingAnalysisView. */
  hideFaseOverride?: boolean;
  onClose: () => void;
}) {
  const { requestClose, containerRef } = useModalGuard<HTMLDivElement>(false, onClose);
  const [tab, setTab] = useState<"journal" | "analyse">("journal");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={requestClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-project-title"
        className="w-full max-w-6xl rounded-xl bg-surface border border-border p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="admin-project-title" className="font-display text-xl italic text-ink">
              {project.naam}
            </h2>
            {project.beschrijving && <p className="font-mono text-xs mt-1 text-muted">{project.beschrijving}</p>}
          </div>
          <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
            <X size={18} />
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-border overflow-hidden w-fit mb-4">
          <button
            onClick={() => setTab("journal")}
            className={`px-4 py-2 text-sm font-body ${tab === "journal" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
          >
            Journal
          </button>
          <button
            onClick={() => setTab("analyse")}
            className={`px-4 py-2 text-sm font-body ${tab === "analyse" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
          >
            Analyse
          </button>
        </div>

        {tab === "journal" ? (
          <ReadOnlyTradesViewer trades={trades} title={`${trades.length} trades`} />
        ) : (
          <BacktestingAnalysisView trades={trades} hideFaseOverride={hideFaseOverride} />
        )}
      </div>
    </div>
  );
}
