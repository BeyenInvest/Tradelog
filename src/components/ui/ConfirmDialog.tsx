import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  message: string;
  /** Confirm-button label. Defaults to common.confirm. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" paints the confirm button in the loss color for destructive actions (delete). */
  tone?: "default" | "danger";
  /** When true the confirm button is greyed out and inert — for a dialog that explains why an action is blocked (e.g. a non-empty journal), leaving only Cancel. */
  confirmDisabled?: boolean;
  /** Optional richer body below the message (e.g. a counts list). */
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Shared confirm/cancel dialog built on the app's Modal chrome — the in-app
 * replacement for window.confirm(), so destructive prompts (trade delete) match
 * the rest of the UI instead of a raw browser alert.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "default",
  confirmDisabled = false,
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal labelledBy="confirm-dialog-title" maxWidthClass="max-w-md" onClose={onClose}>
      {(requestClose) => (
        <div className="flex flex-col gap-4">
          <h3 id="confirm-dialog-title" className="font-display text-xl italic text-ink">
            {title}
          </h3>
          <p className="font-body text-sm text-muted">{message}</p>
          {children}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-surface-2 text-ink hover:bg-ink/5"
            >
              {cancelLabel ?? t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled}
              className={`px-4 py-2 rounded-lg font-body text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                tone === "danger" ? "bg-loss text-white hover:opacity-90" : "bg-gold text-on-gold hover:opacity-90"
              }`}
            >
              {confirmLabel ?? t("common.confirm")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
