import type { ReviewPdfData } from "./reviewPdfData";

/**
 * Warm up the PDF pipeline in the background so the first export isn't a cold
 * start: without this, the first click after a page load had to fetch the heavy
 * react-pdf chunk (~1.4 MB, kept out of the precache — see vite.config), compile
 * the Yoga WASM, and fetch the embedded serif fonts all at once, which made that
 * first download take up to a minute. A throwaway render forces every one of
 * those to happen ahead of time; subsequent exports reuse the warm module cache,
 * the cached Yoga instance, and the registered fonts. Idempotent — the work runs
 * once per session; a failed warm-up resets so a later attempt can retry, and it
 * never surfaces an error (the click path is the one that reports failures).
 */
let warmUp: Promise<void> | null = null;
export function warmUpReviewPdf(): Promise<void> {
  if (!warmUp) {
    warmUp = (async () => {
      const [{ pdf, Document, Page, Text }, { ensurePdfFonts }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./registerPdfFonts"),
      ]);
      ensurePdfFonts();
      await pdf(
        <Document>
          <Page>
            <Text style={{ fontFamily: "InstrumentSerif" }}> </Text>
          </Page>
        </Document>
      ).toBlob();
    })().catch(() => {
      warmUp = null;
    });
  }
  return warmUp;
}

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
