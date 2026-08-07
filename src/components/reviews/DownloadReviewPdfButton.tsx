import { useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReviewPdfData } from "@/lib/pdf/reviewPdfData";
import { generateReviewPdf } from "@/lib/pdf/generateReviewPdf";
import { toErrorMessage } from "@/lib/errorMessage";

/**
 * Export-to-PDF trigger for a review detail panel. Takes a `getData` factory
 * (not the data itself) so the potentially non-trivial adapter work only runs
 * on click, not on every parent render.
 */
export function DownloadReviewPdfButton({ getData }: { getData: () => ReviewPdfData }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function handleClick() {
    if (state === "loading") return;
    setState("loading");
    try {
      await generateReviewPdf(getData());
      setState("idle");
    } catch (err) {
      console.error("PDF export failed", toErrorMessage(err, ""));
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  const isError = state === "error";
  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      title={isError ? t("reviewPdf.failed") : t("reviewPdf.download")}
      aria-label={t("reviewPdf.download")}
      className={`flex items-center gap-1.5 text-xs font-body px-2 py-1.5 rounded-md transition-colors ${
        isError ? "text-loss" : "text-muted hover:text-gold"
      }`}
    >
      {state === "loading" ? (
        <Loader2 size={14} className="animate-spin" />
      ) : isError ? (
        <AlertCircle size={14} />
      ) : (
        <Download size={14} />
      )}
      <span className="hidden sm:inline">{isError ? t("reviewPdf.failed") : t("reviewPdf.download")}</span>
    </button>
  );
}
