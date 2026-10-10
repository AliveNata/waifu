import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rendererRoot = resolve(import.meta.dirname, "src/renderer");

export default defineConfig({
  root: rendererRoot,
  // Relative asset URLs so Electron can load the pages over file://.
  base: "./",
  build: {
    outDir: resolve(import.meta.dirname, "dist/renderer"),
    emptyOutDir: true,
    // three.js alone is ~700 kB. This is a local desktop app, so one big chunk is fine.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        overlay: resolve(rendererRoot, "overlay/index.html"),
        office: resolve(rendererRoot, "office/index.html"),
        teamOverlay: resolve(rendererRoot, "team-overlay/index.html"),
      },
    },
  },
  test: {
    root: import.meta.dirname,
    include: ["test/**/*.test.ts"],
  },
});
