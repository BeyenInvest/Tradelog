import { useEffect } from "react";

/**
 * Wires Escape-to-close on a modal, and gates both Escape and the returned
 * close handler behind a confirm() when the form has unsaved changes — a
 * stray click on the backdrop or an accidental Escape press must not
 * silently discard a half-filled form.
 */
export function useModalGuard(isDirty: boolean, onClose: () => void) {
  function requestClose() {
    if (!isDirty || confirm("Wijzigingen weggooien?")) onClose();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return requestClose;
}
