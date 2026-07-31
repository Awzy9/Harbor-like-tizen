import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "node:path";

/**
 * Several WebTorrent-family packages declare deep `"browser"` field
 * mappings in their package.json (e.g. bittorrent-protocol's
 * `{ "./mse.js": false }`, torrent-discovery's `{ "bittorrent-dht": false }`)
 * that webpack/browserify honor by swapping in an empty module — Node-only
 * functionality (DHT, protocol-level encryption, UDP/HTTP trackers) that has
 * no browser equivalent. Vite's Rollup-based build doesn't apply these
 * mappings, so the real imports resolve as normal and either pull in
 * Node-only code or hit Vite's externalized-builtin stub and fail outright
 * ("X is not exported by __vite-browser-external").
 *
 * Each entry below redirects one such import to a tiny local stub (see
 * scripts/shims/) that exports `undefined` for whatever's actually
 * destructured at the call site. This isn't just silencing a build error:
 * WebTorrent's own source guards every one of these imports with
 * `typeof X === 'function'` before using it (search node_modules for
 * "browser exclude" to see it) specifically so that an absent/`undefined`
 * value degrades to "feature unavailable" — which is the real, intended
 * behavior in a browser context (no DHT, no raw UDP trackers, etc., which
 * is also why torrent playback here depends entirely on WSS trackers/
 * WebSeeds — see TorrentStreamManager).
 */
function webtorrentBrowserExcludeShims(): Plugin {
  const undefinedStub = path.resolve(__dirname, "scripts/shims/browser-unavailable-undefined.js");
  const mseStub = path.resolve(__dirname, "scripts/shims/bittorrent-protocol-mse-shim.js");
  const rules: Array<{ source: string; importerIncludes: string; stub: string }> = [
    { source: "./mse.js", importerIncludes: "bittorrent-protocol", stub: mseStub },
    { source: "bittorrent-dht", importerIncludes: "torrent-discovery", stub: undefinedStub },
    { source: "bittorrent-dht", importerIncludes: "webtorrent", stub: undefinedStub },
    { source: "bittorrent-lsd", importerIncludes: "torrent-discovery", stub: undefinedStub },
  ];
  return {
    name: "webtorrent-browser-exclude-shims",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer) return null;
      const rule = rules.find((r) => r.source === source && importer.includes(r.importerIncludes));
      return rule?.stub ?? null;
    },
  };
}

// Tizen TV apps load index.html via file:// inside the .wgt package, so all
// asset URLs must be relative rather than root-absolute.
export default defineConfig({
  base: "./",
  plugins: [
    webtorrentBrowserExcludeShims(),
    react(),
    // WebTorrent (for torrent/infoHash streams) is a Node-oriented package
    // that reaches for real Node core modules (events, stream, buffer,
    // process, ...) rather than browser-safe equivalents — Vite only
    // polyfills a handful of these by default and errors on the rest at
    // build time. This plugin supplies real browser polyfills so those
    // imports resolve instead of hitting Vite's empty external stubs.
    // Scoped to `include` so it only pulls polyfills into chunks that
    // actually import webtorrent, not into every screen's bundle.
    //
    // "fs" is deliberately left out: this library's own "fs" target is an
    // intentional `null` mock (Node's filesystem API has no browser
    // equivalent), which is *worse* than doing nothing — parse-torrent's own
    // `typeof fs.readFile === 'function'` browser-exclude guard throws on
    // property access against `null` before the typeof check ever runs.
    // Vite's default externalized-builtin stub for a plain, unlisted "fs" is
    // an object (property access safely returns undefined), which is
    // exactly what that guard was written to tolerate.
    nodePolyfills({
      include: ["events", "stream", "buffer", "process", "util", "path", "os"],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
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
