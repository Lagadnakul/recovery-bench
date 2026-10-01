import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * `base: "./"` is D11's requirement, not a preference.
 *
 * The build is a folder of static assets with no server. It has to work opened
 * from `file://` on an examiner's machine, which means every asset reference
 * must be relative. An absolute `/assets/...` would 404 there and the page
 * would render blank.
 *
 * That same requirement is why the fonts are self-hosted through Fontsource
 * rather than linked from Google Fonts: a CDN stylesheet fails silently
 * offline and the page falls back to system faces.
 */
export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@rb/core": resolve(import.meta.dirname, "../core/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // One chunk. There is no routing and no lazy view, so splitting would add
    // requests without deferring anything.
    chunkSizeWarningLimit: 900,
  },
  server: { port: 5178, open: false },
});
