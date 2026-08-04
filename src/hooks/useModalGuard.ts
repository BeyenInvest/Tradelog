import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Wires up a modal: Escape-to-close, a body-scroll lock, and a Tab focus trap, all torn down on
 * unmount (including restoring focus to whatever had it before the modal opened). Escape and the
 * returned close handler are both gated behind a confirm() when the form has unsaved changes — a
 * stray click on the backdrop or an accidental Escape press must not silently discard a
 * half-filled form. Attach the returned `containerRef` to the modal's root element.
 *
 * The setup effect intentionally runs once (mount/unmount only, not on every isDirty/onClose
 * change) — isDirty and onClose are read from refs inside so the keydown handler always sees the
 * latest values without tearing down and re-adding the listener on every keystroke.
 */
export function useModalGuard<T extends HTMLElement = HTMLDivElement>(isDirty: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null);
  const isDirtyRef = useRef(isDirty);
  const onCloseRef = useRef(onClose);
  isDirtyRef.current = isDirty;
  onCloseRef.current = onClose;

  function requestClose() {
    if (!isDirtyRef.current || confirm("Wijzigingen weggooien?")) onCloseRef.current();
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
        requestClose();
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

  return { requestClose, containerRef };
}
