import { useEffect, useRef, useState } from "react";
import { Eye, X, ImagePlus, Loader2, ImageOff } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";
import {
  isStoragePath,
  resolveScreenshotUrl,
  uploadScreenshot,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MIME_TYPES,
} from "@/lib/storage/screenshots";
import { Field } from "./Field";
import { ImagePreviewModal, type ScreenshotFieldName } from "./UrlPreviewField";

interface ScreenshotUploadFieldProps {
  name: ScreenshotFieldName;
  label: string;
}

/** Resolve a stored screenshot value (URL or bucket path) to a displayable URL, re-resolving when the value changes. */
function useResolvedScreenshot(value: string): { url: string | null; loading: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) {
      setUrl(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    resolveScreenshotUrl(value).then((resolved) => {
      if (cancelled) return;
      setUrl(resolved);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return { url, loading };
}

/**
 * Beta variant of UrlPreviewField (Fase K): paste (Ctrl+V), drag-drop or browse
 * a chart screenshot straight into the trade form. Uploads to the private
 * `screenshots` bucket and stores the returned path in the same *_screenshot
 * column; a pasted image URL keeps working too (stored verbatim). Gated on
 * useAuth().betaFeatures at the call site (TechnicalSection).
 */
export function ScreenshotUploadField({ name, label }: ScreenshotUploadFieldProps) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { register, watch, setValue } = useFormContext<TradeFormValues>();

  const raw = watch(name);
  const value = typeof raw === "string" ? raw.trim() : "";
  const hasValue = value !== "";
  const isUpload = hasValue && isStoragePath(value);

  const { url: resolvedUrl, loading: resolving } = useResolvedScreenshot(value);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset the thumbnail's error state whenever the resolved URL changes (e.g. a
  // fresh signed URL, or a newly typed value), so a past failure doesn't stick.
  useEffect(() => setThumbFailed(false), [resolvedUrl]);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    if (!(SCREENSHOT_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError(t("tradeForm.screenshotBadType"));
      return;
    }
    if (file.size > SCREENSHOT_MAX_BYTES) {
      setError(t("tradeForm.screenshotTooLarge"));
      return;
    }
    if (!userId) {
      setError(t("tradeForm.screenshotUploadFailed"));
      return;
    }
    setUploading(true);
    try {
      const path = await uploadScreenshot(file, userId);
      setValue(name, path, { shouldDirty: true, shouldValidate: true });
    } catch {
      setError(t("tradeForm.screenshotUploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    // DataTransferItemList isn't iterable in the DOM lib — index it explicitly.
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void handleFile(file);
          return;
        }
      }
    }
    // No image on the clipboard — let the default paste happen (e.g. a URL into the input below).
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    void handleFile(e.dataTransfer?.files?.[0]);
  }

  function remove() {
    setValue(name, null, { shouldDirty: true });
    setError(null);
  }

  // One compact row, like the original URL field: the input IS the paste target
  // (paste fires reliably on an editable input) and also accepts drag-drop; a
  // small browse button folds in file upload; the eye enlarges. An uploaded
  // image shows a tiny-thumbnail pill in place of the input (its raw storage
  // path is never surfaced).
  return (
    <Field label={label}>
      <div className="flex gap-2">
        {isUpload ? (
          <div className="input flex items-center gap-2 min-w-0">
            {resolving ? (
              <Loader2 size={14} className="shrink-0 animate-spin text-muted" />
            ) : resolvedUrl && !thumbFailed ? (
              <img src={resolvedUrl} alt={label} onError={() => setThumbFailed(true)} className="shrink-0 h-5 w-5 rounded object-cover" />
            ) : (
              <ImageOff size={14} className="shrink-0 text-muted" />
            )}
            <span className="truncate text-muted">{t("tradeForm.screenshotUploaded")}</span>
          </div>
        ) : (
          <input
            type="text"
            className="input"
            placeholder={t("tradeForm.screenshotOrUrl")}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            {...register(name)}
          />
        )}

        {!hasValue && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={t("tradeForm.screenshotBrowse")}
            className="shrink-0 px-3 rounded-lg border border-border bg-surface-2 text-muted hover:text-ink transition-colors"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
          </button>
        )}

        <button
          type="button"
          onClick={() => resolvedUrl && setEnlarged(true)}
          disabled={!resolvedUrl}
          title={hasValue ? t("tradeForm.viewScreenshot") : t("tradeForm.fillUrlFirst")}
          className="shrink-0 px-3 rounded-lg border border-border bg-surface-2 text-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Eye size={15} />
        </button>

        {hasValue && (
          <button
            type="button"
            onClick={remove}
            title={t("tradeForm.removeScreenshot")}
            className="shrink-0 px-3 rounded-lg border border-border bg-surface-2 text-muted hover:text-loss transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = ""; // allow re-picking the same file after a remove
        }}
      />

      {error && <p className="mt-1 text-xs text-loss">{error}</p>}
      {enlarged && resolvedUrl && <ImagePreviewModal src={resolvedUrl} label={label} onClose={() => setEnlarged(false)} />}
    </Field>
  );
}
