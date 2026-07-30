import type { Config } from "tailwindcss";

/*
  Theme tokens are CSS variables (see src/index.css :root / :root.light) so every
  usage — bg-bg, text-ink, border-border, including opacity modifiers like
  bg-win/15 — automatically follows the light/dark toggle. Dark values ported
  from archer-journal-preview.jsx: bg #121317 · surface #1B1D23 ·
  surface-2 #22242B · border #2A2D35 · text #F1EFEA · muted #9A9CA5 ·
  gold #D4A64A · win #5FAE82 · loss #E0665A · be #8B93A7
*/
function themed(name: string) {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: themed("bg"),
        surface: themed("surface"),
        "surface-2": themed("surface-2"),
        border: themed("border"),
        "border-soft": themed("border-soft"),
        ink: themed("ink"),
        muted: themed("muted"),
        faint: themed("faint"),
        gold: themed("gold"),
        win: themed("win"),
        loss: themed("loss"),
        be: themed("be"),
        // Text color for content sitting on a bg-gold surface (buttons, active
        // tabs) — deliberately fixed, not themed, since it must stay dark on
        // gold regardless of light/dark mode.
        "on-gold": "#121317",
      },
      fontFamily: {
        display: ["'Instrument Serif'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        xl: "0.75rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
