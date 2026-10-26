import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tailwind v4 runs as a Turbopack loader, not a PostCSS plugin. Without this
  // block the build still succeeds and still emits a stylesheet -- it just
  // contains the @font-face rules and nothing else, because no source file is
  // ever scanned for class candidates. Every utility silently disappears.
  // Do not remove it.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // Static export, deliberately, even though Vercel does not need it.
  //
  // The console is a view over a finished experiment: 1,604 rows that will never
  // change again. Nothing here needs a server, so keeping the build static costs
  // nothing and buys one thing that matters -- `out/` is a folder that opens
  // offline. The viva may have no internet, and the examiner's copy should not
  // depend on a deployment still being live in 2027.
  //
  // The constraint this imposes: no route handlers, no server actions, no
  // runtime fetches. All data is resolved at build time from src/data/.
  // `next build` writes `out/` directly; there is no separate export command.
  output: "export",

  // Required by `output: "export"` -- the optimizer needs a server.
  images: { unoptimized: true },

  // Emit `/recovery/index.html` rather than `/recovery.html`, so the export
  // works when served from a plain file path as well as from a host.
  trailingSlash: true,

  typedRoutes: true,
};

export default nextConfig;
