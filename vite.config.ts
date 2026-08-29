import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    // PWA (Fase L): installable app + a precached app shell. The service worker
    // is registered manually for every account since the beta flip (see
    // RegisterSW.tsx, which also polls for updates) — injectRegister:null keeps
    // the plugin from auto-registering a second time. The manifest link + icons
    // are injected for all (harmless, just makes the app installable).
    // Deliberately conservative: no runtimeCaching for Supabase (auth + data are
    // cross-origin and must always hit the network).
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Beyen — Trading Journal",
        short_name: "Beyen",
        description: "Trading & backtesting journal. Eyes on every trade.",
        lang: "nl",
        theme_color: "#1E2024",
        // Splash background matches the icon tile (#121317, = --color-bg) so the
        // launch screen reads as one piece with the maskable eye icon.
        background_color: "#121317",
        display: "standalone",
        start_url: "/",
        scope: "/",
        // The gold eye sits at ~62% width on a #121317 tile — safe-zone-proof, so
        // each size is offered as both `any` and `maskable`.
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the built app shell; SPA routes fall back to index.html.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        // Keep the install light on mobile data: leave the big on-demand chunk
        // (react-pdf, ~1.4 MB, only pulled when exporting a PDF) OUT of the
        // precache — it still loads over the network when actually needed.
        // (Excluded via globIgnores rather than a size cap, which this plugin
        // treats as a hard build error.)
        globIgnores: ["**/react-pdf*"],
        navigateFallback: "/index.html",
        // Vite dev/HMR and any /api route must not be served the SPA shell.
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // recharts is large and shared by several code-split pages (Journal,
        // Reviews, Backtesting). Pinning it to its own chunk keeps it out of the
        // initial login bundle and lets the browser cache it across those pages.
        manualChunks: {
          recharts: ["recharts"],
        },
      },
    },
  },
  server: {
    // Pin the dev port so it matches .claude/launch.json (5173). Without
    // strictPort, Vite silently drifts to 5174 when 5173 is busy while the
    // launch config's proxy still points at 5173 → a dead-port mismatch.
    // strictPort makes that collision fail loudly instead of drifting.
    port: 5173,
    strictPort: true,
    proxy: {
      // The unofficial ForexFactory calendar feed has no CORS headers, so the
      // browser can't fetch it directly — the Vite dev server fetches it
      // instead (no browser involved, no CORS check). This only works under
      // `npm run dev`; a production deploy needs a real server-side proxy
      // (e.g. a Supabase Edge Function) doing the same rewrite.
      "/api/ff-calendar": {
        target: "https://nfs.faireconomy.media",
        changeOrigin: true,
        rewrite: () => "/ff_calendar_thisweek.json",
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
