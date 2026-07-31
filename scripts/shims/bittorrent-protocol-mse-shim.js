// Vite/Rollup does not honor bittorrent-protocol's package.json
// `"browser": { "./mse.js": false }` mapping the way webpack/browserify do
// (those replace a `false`-mapped file with an empty module and silently
// tolerate destructuring undefined exports from it; Rollup's static ESM
// analysis throws instead — "nativeRC4 is not exported by
// __vite-browser-external"). This file is aliased over the real mse.js
// (see vite.config.ts) to supply the same two exports without pulling in
// Node's `crypto` module at all.
//
// This is safe because WebTorrent never enables BitTorrent protocol
// encryption (peEnabled defaults to 0 and nothing in webtorrent's source
// passes a non-zero value) — MessageStreamEncryptor is therefore never
// actually constructed. It throws if that ever changes, rather than
// silently doing nothing.
export const nativeRC4 = false;

export class MessageStreamEncryptor {
  constructor() {
    throw new Error("bittorrent protocol encryption (MSE) is not supported in the browser build of this app");
  }
}
