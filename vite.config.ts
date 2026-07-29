import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
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
