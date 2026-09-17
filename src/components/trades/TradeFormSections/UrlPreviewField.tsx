import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, X, ImageOff, ExternalLink } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { Field } from "./Field";

export type ScreenshotFieldName = "w_screenshot" | "d_screenshot" | "h4_screenshot" | "h2_screenshot";

interface UrlPreviewFieldProps {
  name: ScreenshotFieldName;
  label: string;
}

/** URL input with an eye button that opens the screenshot large, in-app — for looking back at a trade's charts later. */
export function UrlPreviewField({ name, label }: UrlPreviewFieldProps) {
  const { t } = useTranslation();
  const { register, watch } = useFormContext<TradeFormValues>();
  const value = watch(name);
  const url = typeof value === "string" ? value.trim() : "";
  const hasUrl = url !== "";
  const href = hasUrl ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : undefined;

  const [open, setOpen] = useState(false);

  return (
    // Non-beta (URL-only) variant keeps its original "(url)" label hint; the beta
    // upload field (ScreenshotUploadField) is passed the clean label. Keeping the
    // suffix here — not in the shared i18n label — means existing users see the
    // form exactly as before while the feature stays behind the beta gate.
    <Field label={`${label}${t("tradeForm.urlLabelSuffix")}`}>
      <div className="flex gap-2">
        <input type="text" className="input" {...register(name)} />
        <button
          type="button"
          onClick={() => hasUrl && setOpen(true)}
          disabled={!hasUrl}
          title={hasUrl ? t("tradeForm.viewScreenshot") : t("tradeForm.fillUrlFirst")}
          className="shrink-0 px-3 rounded-lg border border-border bg-surface-2 text-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Eye size={15} />
        </button>
      </div>
      {open && href && <ImagePreviewModal src={href} label={label} onClose={() => setOpen(false)} />}
    </Field>
  );
}

export function ImagePreviewModal({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // The portal takes the lightbox out of the parent modal's DOM subtree, so
    // useModalGuard's Tab-trap no longer sees these controls — without our own
    // focus handling a keyboard user could never reach the close button (and
    // native Tab order could even walk focus behind the backdrop). Same "X1"
    // pattern as the discard prompt in useModalGuard: own trap root, and focus
    // restored to whatever opened us.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Capture phase + stopPropagation: the lightbox is opened from *inside* other
        // modals (TradeForm, DayTradesModal, ReadOnlyTradeDetailModal) whose useModalGuard
        // listens for Escape on window in the bubble phase. A capture listener on window
        // runs first, and stopping propagation there keeps the same Escape from also
        // raising the trade form's discard prompt / closing the parent modal — one
        // Escape closes exactly one layer, the topmost.
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = overlayRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      );
      if (focusable.length === 0) return;
      // Also in the capture phase: the parent modal's own Tab-trap would otherwise
      // bounce focus around the form underneath while the lightbox is on top.
      e.stopPropagation();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  // Portalled to <body> on purpose — three separate problems this solves, none of them
  // fixable with a higher z-index alone:
  //  1. Containment/stacking: the call sites render this deep inside another modal
  //     (TradeForm is `fixed inset-0 z-50`), so a z-index here only ever competes
  //     *within* that parent's stacking context — any other top-level `fixed z-50`
  //     layer mounted later in the DOM paints over the lightbox and swallows its
  //     clicks (backdrop not covering the whole screen, close button unreachable).
  //  2. Field wraps its children in a <label>: in-tree, every click inside the overlay
  //     also triggers the label's native activation behaviour on the field's input
  //     (React's stopPropagation does not prevent a native default on a DOM ancestor).
  //  3. An ancestor that ever gains a transform/filter/animation would turn `fixed`
  //     into a box relative to that ancestor instead of the viewport.
  // z-[100] keeps it above every in-app layer (modals z-50, discard prompt z-[60]).
  //
  // React still propagates events through the *React* tree, not the DOM tree, so the
  // parent modals' backdrop-click-to-close handlers would still fire: every click here
  // must keep stopping propagation.
  const overlay = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={t("tradeForm.openNewTab")}
          className="p-2 rounded-lg text-muted hover:text-ink hover:bg-ink/5"
        >
          <ExternalLink size={18} />
        </a>
        <button
          ref={closeBtnRef}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title={t("common.close")}
          className="p-2 rounded-lg text-muted hover:text-ink hover:bg-ink/5"
        >
          <X size={20} />
        </button>
      </div>

      {failed ? (
        <div
          className="flex flex-col items-center gap-3 rounded-xl p-8 bg-surface border border-border max-w-sm text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <ImageOff size={28} className="text-muted" />
          <p className="text-sm text-ink">{t("tradeForm.imgFailed")}</p>
          <p className="text-xs text-muted">{t("tradeForm.imgFailedHint", { label })}</p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
          >
            {t("tradeForm.openNewTab")}
          </a>
        </div>
      ) : (
        <img
          src={src}
          alt={label}
          onError={() => setFailed(true)}
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-full rounded-lg border border-border object-contain"
        />
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
