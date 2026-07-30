import { useEffect, useState } from "react";
import { Eye, X, ImageOff, ExternalLink } from "lucide-react";
import { useFormContext } from "react-hook-form";
import type { TradeFormValues } from "@/lib/validation";
import { Field } from "./Field";

type ScreenshotField = "w_screenshot" | "d_screenshot" | "h4_screenshot" | "h2_screenshot";

interface UrlPreviewFieldProps {
  name: ScreenshotField;
  label: string;
}

/** URL input with an eye button that opens the screenshot large, in-app — for looking back at a trade's charts later. */
export function UrlPreviewField({ name, label }: UrlPreviewFieldProps) {
  const { register, watch } = useFormContext<TradeFormValues>();
  const value = watch(name);
  const url = typeof value === "string" ? value.trim() : "";
  const hasUrl = url !== "";
  const href = hasUrl ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : undefined;

  const [open, setOpen] = useState(false);

  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="text" className="input" {...register(name)} />
        <button
          type="button"
          onClick={() => hasUrl && setOpen(true)}
          disabled={!hasUrl}
          title={hasUrl ? "Screenshot bekijken" : "Vul eerst een URL in"}
          className="shrink-0 px-3 rounded-lg border border-border bg-surface-2 text-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Eye size={15} />
        </button>
      </div>
      {open && href && <ImagePreviewModal src={href} label={label} onClose={() => setOpen(false)} />}
    </Field>
  );
}

function ImagePreviewModal({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Openen in nieuw tabblad"
          className="p-2 rounded-lg text-muted hover:text-ink hover:bg-ink/5"
        >
          <ExternalLink size={18} />
        </a>
        <button onClick={onClose} title="Sluiten" className="p-2 rounded-lg text-muted hover:text-ink hover:bg-ink/5">
          <X size={20} />
        </button>
      </div>

      {failed ? (
        <div
          className="flex flex-col items-center gap-3 rounded-xl p-8 bg-surface border border-border max-w-sm text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <ImageOff size={28} className="text-muted" />
          <p className="text-sm text-ink">Kon dit niet als afbeelding tonen.</p>
          <p className="text-xs text-muted">{label} bevat mogelijk een link naar een pagina, geen directe afbeelding.</p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
          >
            Openen in nieuw tabblad
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
