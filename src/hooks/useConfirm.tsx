import { useCallback, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message: string;
  /** Confirm-button label; defaults to common.confirm inside ConfirmDialog. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" paints the confirm button in the loss colour — for destructive prompts. */
  tone?: "default" | "danger";
}

/**
 * Promise-based replacement for window.confirm() (N15): call `await confirm(opts)`
 * for a boolean, and render `confirmDialog` once in the component. Backed by the
 * shared ConfirmDialog (Modal chrome, focus-trap, i18n), so destructive prompts
 * match the rest of the app instead of a raw, unstyled, untranslated browser
 * alert. Cancel / backdrop / Escape all resolve `false`.
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setOpts(null);
  }, []);

  const confirmDialog: ReactNode = opts ? (
    <ConfirmDialog
      title={opts.title}
      message={opts.message}
      confirmLabel={opts.confirmLabel}
      cancelLabel={opts.cancelLabel}
      tone={opts.tone}
      onConfirm={() => settle(true)}
      onClose={() => settle(false)}
    />
  ) : null;

  return { confirm, confirmDialog };
}
