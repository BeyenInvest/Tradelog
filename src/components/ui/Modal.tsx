import type { ReactNode } from "react";
import clsx from "clsx";
import { useModalGuard } from "@/hooks/useModalGuard";

interface ModalProps {
  /** id of the heading inside `children`, wired to the dialog's aria-labelledby. */
  labelledBy: string;
  /** Tailwind max-width class for the dialog (e.g. "max-w-2xl", "max-w-6xl"). */
  maxWidthClass: string;
  /** Cap the dialog at 85vh and scroll its body — for long content (reviews, trade detail). Day-trade modals leave it off. */
  scroll?: boolean;
  /** Gates Escape/backdrop-close behind a confirm() when the dialog holds unsaved edits. Read-only modals leave it false. */
  isDirty?: boolean;
  onClose: () => void;
  /** Render-prop so each caller keeps its own exact header markup (incl. the close button); `requestClose` respects isDirty. */
  children: (requestClose: () => void) => ReactNode;
}

/**
 * The shared centered-dialog chrome (backdrop, dialog box, Escape/backdrop close,
 * body-scroll lock + focus trap via useModalGuard) behind every centered modal —
 * the owner-facing DayTradesModal and the admin read-only drill-down modals. Only
 * the shell is shared: the header row and body come from the caller unchanged, so
 * per-modal title/subtitle/alignment/width stay exactly as they were.
 */
export function Modal({ labelledBy, maxWidthClass, scroll = false, isDirty = false, onClose, children }: ModalProps) {
  const { requestClose, containerRef } = useModalGuard<HTMLDivElement>(isDirty, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={requestClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={clsx("w-full rounded-xl bg-surface border border-border p-6", maxWidthClass, scroll && "max-h-[85vh] overflow-y-auto")}
        onClick={(e) => e.stopPropagation()}
      >
        {children(requestClose)}
      </div>
    </div>
  );
}
