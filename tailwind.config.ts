import type { Config } from "tailwindcss";

/*
  Tokens ported from archer-journal-preview.jsx:
  bg #121317 · surface #1B1D23 · surface-2 #22242B · border #2A2D35
  text #F1EFEA · muted #9A9CA5 · gold #D4A64A · win #5FAE82
  loss #E0665A · be #8B93A7
*/
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#121317",
        surface: "#1B1D23",
        "surface-2": "#22242B",
        border: "#2A2D35",
        "border-soft": "#21232A",
        ink: "#F1EFEA",
        muted: "#9A9CA5",
        faint: "#5A5C64",
        gold: "#D4A64A",
        win: "#5FAE82",
        loss: "#E0665A",
        be: "#8B93A7",
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
