import { X } from "lucide-react";
import { useModalGuard } from "@/hooks/useModalGuard";
import { ReadOnlyTradesViewer } from "@/components/admin/ReadOnlyTradesViewer";
import type { BacktestProject, Trade } from "@/lib/types";

/** Read-only equivalent of ProjectDashboardPage's journal tab — a project's trades, for the admin debug view. */
export function ReadOnlyProjectModal({
  project, trades, onClose,
}: {
  project: BacktestProject;
  trades: Trade[];
  onClose: () => void;
}) {
  const { requestClose, containerRef } = useModalGuard<HTMLDivElement>(false, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={requestClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-project-title"
        className="w-full max-w-3xl rounded-xl bg-surface border border-border p-6 max-h-[85vh] overflow-y-auto"
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

        <ReadOnlyTradesViewer trades={trades} title={`${trades.length} trades`} />
      </div>
    </div>
  );
}
