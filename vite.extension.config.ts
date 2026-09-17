// Aparte Vite-config voor de Chrome-extensie (MV3) in extension/ — zie
// docs/plan-tv-extensie-engines.md §2.5/§2.6. Bewust dezelfde tooling als de
// web-app (geen extra bundler-dependency); output is ESM zodat de service
// worker ("type": "module") en de popup chunks kunnen delen.
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: "extension",
  resolve: {
    // Zelfde "@"-alias als de web-app, zodat gedeelde src/lib-modules
    // (quickLog → validation → constants) ongewijzigd meebundelen (plan §2.5).
    alias: { "@": r("./src") },
  },
  // Relatieve asset-paden: de popup leeft op chrome-extension://<id>/dist/popup.html,
  // een absolute "/popup.js" zou buiten dist/ wijzen.
  base: "./",
  publicDir: false,
  build: {
    outDir: "dist", // → extension/dist (gitignored; `npm run build:ext`)
    emptyOutDir: true,
    target: "chrome111",
    // Geen modulepreload-polyfill: die raakt `document` en zou de service
    // worker (geen DOM) laten crashen.
    modulePreload: false,
    rollupOptions: {
      input: {
        sw: r("./extension/src/sw.ts"),
        popup: r("./extension/popup.html"),
      },
      output: {
        // Stabiele bestandsnamen: manifest.json verwijst hier letterlijk naar.
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
