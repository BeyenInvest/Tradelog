import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Wires up a modal: Escape-to-close, a body-scroll lock, and a Tab focus trap, all torn down on
 * unmount (including restoring focus to whatever had it before the modal opened). Escape and the
 * returned close handler are both gated behind an in-app confirm dialog when the form has unsaved
 * changes — a stray click on the backdrop or an accidental Escape press must not silently discard
 * a half-filled form. Attach the returned `containerRef` to the modal's root element and render
 * `discardDialog` somewhere in the modal's JSX (it is null until the guard trips).
 *
 * The discard prompt is deliberately a self-contained overlay, not the shared ConfirmDialog —
 * that one is built on Modal, which itself uses this hook (circular import). Styling mirrors it.
 *
 * The setup effect intentionally runs once (mount/unmount only, not on every isDirty/onClose
 * change) — isDirty and onClose are read from refs inside so the keydown handler always sees the
 * latest values without tearing down and re-adding the listener on every keystroke.
 */
export function useModalGuard<T extends HTMLElement = HTMLDivElement>(isDirty: boolean, onClose: () => void) {
  const { t } = useTranslation();
  const containerRef = useRef<T>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const isDirtyRef = useRef(isDirty);
  const onCloseRef = useRef(onClose);
  const confirmingRef = useRef(confirmingDiscard);
  isDirtyRef.current = isDirty;
  onCloseRef.current = onClose;
  confirmingRef.current = confirmingDiscard;

  function requestClose() {
    if (!isDirtyRef.current) onCloseRef.current();
    else setConfirmingDiscard(true);
  }

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Respect a field's own autoFocus (e.g. DeleteAccountModal's confirm input) — only steal focus
    // into the container if nothing inside it is already focused.
    if (!containerRef.current?.contains(document.activeElement)) {
      containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // First Escape with unsaved changes raises the discard prompt; while it
        // is up, Escape dismisses the prompt (cancel), not the whole modal.
        if (confirmingRef.current) setConfirmingDiscard(false);
        else requestClose();
        return;
      }
      if (e.key !== "Tab" || !containerRef.current) return;
      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const discardDialog: ReactNode = confirmingDiscard ? (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={() => setConfirmingDiscard(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-dialog-title"
        className="w-full max-w-md rounded-xl bg-surface border border-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-4">
          <h3 id="discard-dialog-title" className="font-display text-xl italic text-ink">
            {t("common.discardTitle")}
          </h3>
          <p className="font-body text-sm text-muted">{t("common.discardBody")}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDiscard(false)}
              className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-surface-2 text-ink hover:bg-ink/5"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDiscard(false);
                onCloseRef.current();
              }}
              className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-loss text-white hover:opacity-90"
            >
              {t("common.discard")}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return { requestClose, containerRef, discardDialog };
}
