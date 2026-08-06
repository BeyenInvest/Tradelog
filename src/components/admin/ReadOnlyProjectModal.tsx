import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
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
  const { t } = useTranslation();
  const [tab, setTab] = useState<"journal" | "analyse">("journal");

  return (
    <Modal labelledBy="admin-project-title" maxWidthClass="max-w-6xl" scroll onClose={onClose}>
      {(requestClose) => (
        <>
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
              {t("journal.tabJournal")}
            </button>
            <button
              onClick={() => setTab("analyse")}
              className={`px-4 py-2 text-sm font-body ${tab === "analyse" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
            >
              {t("journal.tabAnalyse")}
            </button>
          </div>

          {tab === "journal" ? (
            <ReadOnlyTradesViewer trades={trades} title={t("journal.tradesCount", { count: trades.length })} />
          ) : (
            <BacktestingAnalysisView trades={trades} hideFaseOverride={hideFaseOverride} />
          )}
        </>
      )}
    </Modal>
  );
}
