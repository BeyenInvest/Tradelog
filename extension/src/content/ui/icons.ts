// Constante SVG-strings voor het paneel. Het merkteken is dezelfde REV-07-
// geometrie als LogoMark in src/components/ui/Logo.tsx — de web-app tekent 'm in
// JSX, de extensie kan geen React importeren, dus staan de paden hier als string.
// Bij een merkwijziging: beide bijwerken.

const MARK_VIEWBOX = "133.95 687.84 732.10 624.32";

/** BY-monogram met oog, in currentColor. `size` = hoogte in px. */
export function markSvg(size: number): string {
  const width = Math.round(size * (732.1 / 624.32));
  return `<svg width="${width}" height="${size}" viewBox="${MARK_VIEWBOX}" fill="currentColor" aria-hidden="true">
  <rect x="133.95" y="821.35" width="67.11" height="490.51"/>
  <polygon points="201.06,1245.79 201.06,1311.86 137.41,1311.86 158.17,1290.07"/>
  <rect x="504.05" y="1180.93" transform="matrix(-1.836970e-16 1 -1 -1.836970e-16 1815.9039 612.9057)" width="194.91" height="66.95"/>
  <polygon points="866.05,821.36 846.69,849.79 630.93,1166.72 575.81,1128.69 785.29,821.36"/>
  <polygon points="627.23,1128.87 571.89,1166.57 492.32,1049.65 472.26,1020.59 518.96,970.44 539.02,999.49"/>
  <path d="M463.35,950.74c0,35.14-13.95,66.89-36.51,90.02l-0.57,0.57l-0.79,0.91l-46.26,47.96c-11.79-6.46-25.28-10.2-39.79-10.2H222.55v-66.43h45.57v-0.11h59.86c34.69,0,62.58-28.12,62.58-62.69c0-34.69-27.89-62.58-62.58-62.58H134.01v-66.77h199.87C405.53,821.38,463.35,879.09,463.35,950.74z"/>
  <rect x="134" y="1013.4" width="66.98" height="66.63"/>
  <path d="M488.85,1162.74v0.11c0,82.42-66.89,149.31-149.31,149.31H201.01v-66.66h138.42c45.69,0,82.76-37.07,82.76-82.76c0-22.79-9.3-43.53-24.26-58.5c-5.55-5.56-11.79-10.32-18.71-14.06c-11.79-6.46-25.28-10.2-39.79-10.2H222.55v-66.55h117c32.31,0,62.24,10.32,86.73,27.89C464.14,1068.3,488.85,1112.63,488.85,1162.74z"/>
  <path d="M750.69,789.31c-63.65-69.87-131.79-103.77-203.05-101.35c-105.5,3.8-178.49,87.16-189.9,100.66v0.35c13.13,1.72,25.59,5.18,37.7,10.02c23.52-24.2,80.59-73.66,153.59-76.44c56.03-2.07,112.07,24.55,165.7,78.87c-22.5,23.52-80.96,75.76-155.66,78.18c-30.8,1.39-60.89-5.89-90.29-21.44c9.68,14.18,17.3,29.74,22.13,46.7c20.43,6.57,41.17,9.68,61.92,9.68c2.78,0,5.18,0,7.61-0.35c112.09-3.82,188.18-98.24,191.29-102.38l9-11.43L750.69,789.31z"/>
  <path d="M559.01,734.93c-36.59,0-66.27,29.66-66.27,66.25c0,36.61,29.68,66.27,66.27,66.27c36.59,0,66.25-29.66,66.25-66.27C625.26,764.59,595.6,734.93,559.01,734.93z M559.01,827.69c-14.63,0-26.51-11.86-26.51-26.51c0-14.63,11.88-26.49,26.51-26.49c14.63,0,26.51,11.86,26.51,26.49C585.52,815.83,573.64,827.69,559.01,827.69z"/>
</svg>`;
}

const stroke = (paths: string, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICON_CLOSE = stroke('<path d="M18 6 6 18M6 6l12 12"/>', 15);
export const ICON_PENCIL = stroke('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 13);
export const ICON_REFRESH = stroke('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>', 13);
export const ICON_CHECK = stroke('<path d="M20 6 9 17l-5-5"/>', 22);
export const ICON_LINK = stroke(
  '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  13
);
export const ICON_EXTERNAL = stroke('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>', 13);
export const ICON_ARROW_UP = stroke('<path d="M7 17 17 7"/><path d="M8 7h9v9"/>', 14);
export const ICON_ARROW_DOWN = stroke('<path d="M7 7 17 17"/><path d="M17 8v9H8"/>', 14);
export const ICON_CLOCK = stroke('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 12);
