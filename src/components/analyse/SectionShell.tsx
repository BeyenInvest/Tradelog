import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

interface SectionShellProps {
  id: string;
  title: string;
  /** Optional right-aligned header control (e.g. the breakdowns Totaal/Per-Fase toggle). */
  action?: ReactNode;
  /**
   * When true, the shell shows the collapse chevron + drag handle and honours
   * `collapsed`/reorder. When false it's a plain titled section, always expanded —
   * so non-beta users see the page exactly as a fixed layout with headings.
   */
  interactive: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onReorder: (fromId: string, toId: string) => void;
  children: ReactNode;
}

/** Six-dot drag grip. */
function GripIcon() {
  return (
    <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor" aria-hidden>
      {[2, 8, 14].map((cy) =>
        [2, 8].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.3} />)
      )}
    </svg>
  );
}

/**
 * Wraps one Analyse-page section with a header (title + optional action) and, for
 * beta users, a collapse toggle and a native drag-to-reorder handle. Layout state
 * itself lives in useAnalyseLayout — this component is purely presentational and
 * fires callbacks. Reordering uses the HTML5 drag-and-drop API (no dependency): the
 * whole section is a drop target, the grip is the drag source.
 */
export function SectionShell({ id, title, action, interactive, collapsed, onToggle, onReorder, children }: SectionShellProps) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);

  const dropProps = interactive
    ? {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragOver(false);
          const from = e.dataTransfer.getData("text/plain");
          if (from && from !== id) onReorder(from, id);
        },
      }
    : {};

  return (
    <section
      {...dropProps}
      className={clsx(
        "flex flex-col gap-3 rounded-xl transition-shadow",
        dragOver && interactive && "ring-2 ring-gold/60 ring-offset-4 ring-offset-surface-1"
      )}
    >
      <div className="flex items-center gap-2">
        {interactive && (
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", id);
              e.dataTransfer.effectAllowed = "move";
            }}
            className="cursor-grab active:cursor-grabbing text-muted/50 hover:text-muted -ml-1 p-1 select-none"
            title={t("analyseLayout.drag")}
            aria-hidden
          >
            <GripIcon />
          </span>
        )}
        {interactive ? (
          <button
            onClick={onToggle}
            className="flex items-center gap-2 text-left"
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("analyseLayout.expand") : t("analyseLayout.collapse")}
          >
            <svg
              className={clsx("w-3 h-3 text-muted transition-transform shrink-0", collapsed && "-rotate-90")}
              viewBox="0 0 12 12"
              fill="none"
            >
              <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 className="font-display text-xl italic text-ink">{title}</h2>
          </button>
        ) : (
          <h2 className="font-display text-xl italic text-ink">{title}</h2>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {!collapsed && <div className="flex flex-col gap-4">{children}</div>}
    </section>
  );
}
