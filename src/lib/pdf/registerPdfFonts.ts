import { Font } from "@react-pdf/renderer";
import serifRegular from "@/assets/fonts/InstrumentSerif-Regular.ttf";
import serifItalic from "@/assets/fonts/InstrumentSerif-Italic.ttf";

/**
 * Registers the app's display serif (Instrument Serif) for the PDF. The .ttf
 * files are bundled with the app (Vite emits them as same-origin assets), so
 * this carries no external-CDN dependency — the font is as reachable as the app
 * itself. Idempotent; safe to call before every render.
 *
 * Only the display serif is embedded. Body/UI text stays on the built-in
 * Helvetica (a clean, always-available substitute for Inter), keeping the
 * embedded payload to the one face that actually carries the brand.
 */
let registered = false;

export function ensurePdfFonts(): void {
  if (registered) return;
  Font.register({
    family: "InstrumentSerif",
    fonts: [
      { src: serifRegular, fontStyle: "normal" },
      { src: serifItalic, fontStyle: "italic" },
    ],
  });
  registered = true;
}
