import { useEffect, useState } from "react";
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // This can render nested inside another modal's own backdrop-click-to-close handler (e.g. TradeForm,
  // ReadOnlyTradeDetailModal) — every click here must stop propagation, or closing the screenshot
  // bubbles up and closes the parent modal too.
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
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
}
