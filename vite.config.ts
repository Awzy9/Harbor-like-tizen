import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Tizen TV apps load index.html via file:// inside the .wgt package, so all
// asset URLs must be relative rather than root-absolute.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    target: "es2017",
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});
