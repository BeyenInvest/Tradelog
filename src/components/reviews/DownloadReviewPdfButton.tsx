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
  const [errMsg, setErrMsg] = useState("");

  async function handleClick() {
    if (state === "loading") return;
    setState("loading");
    setErrMsg("");
    try {
      await generateReviewPdf(getData());
      setState("idle");
    } catch (err) {
      // Log the raw error (message + stack), not a pre-stringified summary, so the
      // real cause is visible in the console and surfaced to the user below.
      console.error("PDF export failed:", err);
      setErrMsg(toErrorMessage(err, String(err)));
      setState("error");
    }
  }

  const isError = state === "error";
  return (
    <div className="flex items-center gap-2">
      {isError && errMsg && (
        <span className="hidden md:inline max-w-[280px] truncate text-[11px] text-loss/90" title={errMsg}>
          {errMsg}
        </span>
      )}
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        title={isError ? errMsg || t("reviewPdf.failed") : t("reviewPdf.download")}
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
    </div>
  );
}
