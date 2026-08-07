import type { ReviewPdfData } from "./reviewPdfData";

function fileNameFor(heading: string): string {
  const slug = heading
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `beyen-review-${slug || "export"}.pdf`;
}

/**
 * Renders a review to a branded PDF and triggers a download. react-pdf and the
 * document component are imported dynamically so the (heavy) renderer is split
 * out of the main bundle and only fetched when a user actually exports.
 */
export async function generateReviewPdf(data: ReviewPdfData): Promise<void> {
  const [{ pdf }, { ReviewPdfDocument }, { ensurePdfFonts }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./ReviewPdfDocument"),
    import("./registerPdfFonts"),
  ]);
  ensurePdfFonts();

  const blob = await pdf(<ReviewPdfDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileNameFor(data.heading);
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke on the next tick so the click-initiated download has taken the URL.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
