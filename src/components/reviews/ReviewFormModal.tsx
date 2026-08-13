import type { FormEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useModalGuard } from "@/hooks/useModalGuard";

interface ReviewFormModalProps {
  title: string;
  /** Unique id linking the heading to the dialog's aria-labelledby. */
  titleId: string;
  /** Gates Escape/backdrop-close behind a confirm() when there are unsaved changes. */
  isDirty: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  error: string | null;
  children: ReactNode;
}

/**
 * The shared right-hand side-panel chrome for both review forms (weekly and
 * periodic): backdrop, dialog container, header + close button, the <form>
 * wrapper, and the error line + Annuleren/Opslaan footer. The forms differ only
 * in their identity fields and content editor, which they pass as `children`.
 */
export function ReviewFormModal({ title, titleId, isDirty, onClose, onSubmit, submitting, error, children }: ReviewFormModalProps) {
  const { t } = useTranslation();
  const { requestClose, containerRef, discardDialog } = useModalGuard<HTMLDivElement>(isDirty, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50" onClick={requestClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-4xl h-full bg-surface border-l border-border overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id={titleId} className="font-display text-2xl italic text-ink">{title}</h2>
          <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {children}

          {error && <p className="text-sm text-loss">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={requestClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-ink">
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
            >
              {submitting ? t("common.submitting") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
      {discardDialog}
    </div>
  );
}
