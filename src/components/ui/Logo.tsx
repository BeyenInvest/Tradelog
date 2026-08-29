// The definitive Beyen brand marks (REV 07), drawn as inline SVG so they inherit
// `currentColor` (colour them with `text-gold` / `text-ink`) and stay crisp at any
// size and in both light/dark themes. All three share the source artwork's exact
// geometry; each is sized by `size` = rendered HEIGHT in px, width follows the
// mark's natural aspect ratio. The eye's pupil cut-out is a reverse-wound subpath
// (default non-zero fill-rule), matching the source.

interface LogoProps {
  /** Rendered height in px; width scales with the mark's natural aspect ratio. */
  size?: number;
  className?: string;
}

const MARK_VIEWBOX = "133.95 687.84 732.10 624.32";
const MARK_RATIO = 732.1 / 624.32; // ≈ 1.173

const WORDMARK_VIEWBOX = "391.16 980.81 403.54 72.96";
const WORDMARK_RATIO = 403.54 / 72.96; // ≈ 5.531

const LOCKUP_VIEWBOX = "205.30 932.54 589.40 134.92";
const LOCKUP_RATIO = 589.4 / 134.92; // ≈ 4.368

// BY-monogram-with-eye icon paths.
const MarkPaths = () => (
  <>
    {/* BY monogram */}
    <rect x="133.95" y="821.35" width="67.11" height="490.51" />
    <polygon points="201.06,1245.79 201.06,1311.86 137.41,1311.86 158.17,1290.07" />
    <rect
      x="504.05"
      y="1180.93"
      transform="matrix(-1.836970e-16 1 -1 -1.836970e-16 1815.9039 612.9057)"
      width="194.91"
      height="66.95"
    />
    <polygon points="866.05,821.36 846.69,849.79 630.93,1166.72 575.81,1128.69 785.29,821.36" />
    <polygon points="627.23,1128.87 571.89,1166.57 492.32,1049.65 472.26,1020.59 518.96,970.44 539.02,999.49" />
    <path d="M463.35,950.74c0,35.14-13.95,66.89-36.51,90.02l-0.57,0.57l-0.79,0.91l-46.26,47.96c-11.79-6.46-25.28-10.2-39.79-10.2H222.55v-66.43h45.57v-0.11h59.86c34.69,0,62.58-28.12,62.58-62.69c0-34.69-27.89-62.58-62.58-62.58H134.01v-66.77h199.87C405.53,821.38,463.35,879.09,463.35,950.74z" />
    <rect x="134" y="1013.4" width="66.98" height="66.63" />
    <path d="M488.85,1162.74v0.11c0,82.42-66.89,149.31-149.31,149.31H201.01v-66.66h138.42c45.69,0,82.76-37.07,82.76-82.76c0-22.79-9.3-43.53-24.26-58.5c-5.55-5.56-11.79-10.32-18.71-14.06c-11.79-6.46-25.28-10.2-39.79-10.2H222.55v-66.55h117c32.31,0,62.24,10.32,86.73,27.89C464.14,1068.3,488.85,1112.63,488.85,1162.74z" />
    {/* Eye — pupil with concentric cut-out */}
    <path d="M750.69,789.31c-63.65-69.87-131.79-103.77-203.05-101.35c-105.5,3.8-178.49,87.16-189.9,100.66v0.35c13.13,1.72,25.59,5.18,37.7,10.02c23.52-24.2,80.59-73.66,153.59-76.44c56.03-2.07,112.07,24.55,165.7,78.87c-22.5,23.52-80.96,75.76-155.66,78.18c-30.8,1.39-60.89-5.89-90.29-21.44c9.68,14.18,17.3,29.74,22.13,46.7c20.43,6.57,41.17,9.68,61.92,9.68c2.78,0,5.18,0,7.61-0.35c112.09-3.82,188.18-98.24,191.29-102.38l9-11.43L750.69,789.31z" />
    <path d="M559.01,734.93c-36.59,0-66.27,29.66-66.27,66.25c0,36.61,29.68,66.27,66.27,66.27c36.59,0,66.25-29.66,66.25-66.27C625.26,764.59,595.6,734.93,559.01,734.93z M559.01,827.69c-14.63,0-26.51-11.86-26.51-26.51c0-14.63,11.88-26.49,26.51-26.49c14.63,0,26.51,11.86,26.51,26.49C585.52,815.83,573.64,827.69,559.01,827.69z" />
  </>
);

// "BEYEN" wordmark letter paths.
const WordmarkPaths = () => (
  <>
    <path d="M434.11,1016.25c8.02-2.4,12.61-8.13,12.61-16.47c0-5.73-2.09-10.32-6.26-13.76c-4.06-3.44-9.69-5.21-16.67-5.21h-32.63v72.96h35.13c14.28,0,23.14-7.61,23.14-19.7C449.43,1024.59,443.8,1018.33,434.11,1016.25z M404.3,992.27h16.57c8.44,0,12.3,3.13,12.3,9.28c0,6.26-3.86,9.38-12.3,9.38H404.3V992.27z M423.37,1042.3H404.3v-20.01h19.07c8.23,0,12.3,3.34,12.3,10.01S431.6,1042.3,423.37,1042.3z" />
    <path d="M492.36,1041.78v-18.86h36.16v-11.88h-36.16V992.8h38.46v-11.99h-51.59v72.96h52.63v-11.99H492.36z" />
    <path d="M606.69,980.81l-18.97,31.79l-18.97-31.79h-15.01l27.31,43.67v29.29h13.34v-29.29l27.31-43.67H606.69z" />
    <path d="M659.73,1041.78v-18.86h36.17v-11.88h-36.17V992.8h38.46v-11.99H646.6v72.96h52.63v-11.99H659.73z" />
    <path d="M781.77,980.81v51.7l-38.45-51.7h-12.41v72.96h13.03v-51.7l38.35,51.7h12.41v-72.96H781.77z" />
  </>
);

/** Brand mark: the BY-monogram-with-eye icon. */
export function LogoMark({ size = 20, className }: LogoProps) {
  return (
    <svg
      width={size * MARK_RATIO}
      height={size}
      viewBox={MARK_VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <MarkPaths />
    </svg>
  );
}

/** "BEYEN" wordmark on its own. */
export function LogoWordmark({ size = 18, className }: LogoProps) {
  return (
    <svg
      width={size * WORDMARK_RATIO}
      height={size}
      viewBox={WORDMARK_VIEWBOX}
      fill="currentColor"
      role="img"
      aria-label="Beyen"
      className={className}
    >
      <WordmarkPaths />
    </svg>
  );
}

/** Full horizontal lockup: the icon + "BEYEN", exactly as in the source artwork. */
export function LogoLockup({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size * LOCKUP_RATIO}
      height={size}
      viewBox={LOCKUP_VIEWBOX}
      fill="currentColor"
      role="img"
      aria-label="Beyen"
      className={className}
    >
      {/* Icon + wordmark carry the artwork's own relative placement. */}
      <rect x="205.3" y="961.39" width="14.5" height="106.01" />
      <polygon points="219.8,1053.12 219.8,1067.4 206.05,1067.4 210.53,1062.69" />
      <rect
        x="285.28"
        y="1039.1"
        transform="matrix(-1.836970e-16 1 -1 -1.836970e-16 1352.6813 739.9913)"
        width="42.12"
        height="14.47"
      />
      <polygon points="363.52,961.39 359.33,967.54 312.7,1036.03 300.79,1027.81 346.07,961.39" />
      <polygon points="311.91,1027.85 299.95,1036 282.75,1010.73 278.41,1004.45 288.51,993.61 292.84,999.89" />
      <path d="M276.49,989.35c0,7.6-3.01,14.46-7.89,19.45l-0.12,0.12l-0.17,0.2l-10,10.36c-2.55-1.4-5.46-2.21-8.6-2.21h-25.26v-14.36h9.85v-0.02h12.94c7.5,0,13.52-6.08,13.52-13.55c0-7.5-6.03-13.52-13.52-13.52h-41.92V961.4h43.2C263.99,961.4,276.49,973.87,276.49,989.35z" />
      <rect x="205.31" y="1002.9" width="14.47" height="14.4" />
      <path d="M282,1035.17v0.02c0,17.81-14.46,32.27-32.27,32.27h-29.94v-14.41h29.92c9.87,0,17.89-8.01,17.89-17.89c0-4.92-2.01-9.41-5.24-12.64c-1.2-1.2-2.55-2.23-4.04-3.04c-2.55-1.4-5.46-2.21-8.6-2.21h-25.26v-14.38h25.29c6.98,0,13.45,2.23,18.74,6.03C276.66,1014.76,282,1024.34,282,1035.17z" />
      <path d="M338.59,954.47c-13.75-15.1-28.48-22.43-43.88-21.9c-22.8,0.82-38.58,18.84-41.04,21.75v0.08c2.84,0.37,5.53,1.12,8.15,2.16c5.08-5.23,17.42-15.92,33.19-16.52c12.11-0.45,24.22,5.31,35.81,17.04c-4.86,5.08-17.5,16.37-33.64,16.9c-6.66,0.3-13.16-1.27-19.51-4.63c2.09,3.07,3.74,6.43,4.78,10.09c4.41,1.42,8.9,2.09,13.38,2.09c0.6,0,1.12,0,1.64-0.08c24.22-0.82,40.67-21.23,41.34-22.13l1.95-2.47L338.59,954.47z" />
      <path d="M297.16,942.71c-7.91,0-14.32,6.41-14.32,14.32c0,7.91,6.41,14.32,14.32,14.32s14.32-6.41,14.32-14.32C311.48,949.12,305.07,942.71,297.16,942.71z M297.16,962.76c-3.16,0-5.73-2.56-5.73-5.73c0-3.16,2.57-5.73,5.73-5.73s5.73,2.56,5.73,5.73C302.89,960.2,300.33,962.76,297.16,962.76z" />
      <WordmarkPaths />
    </svg>
  );
}

/** @deprecated Use {@link LogoWordmark}. Retained so existing imports keep working. */
export const Wordmark = LogoWordmark;
