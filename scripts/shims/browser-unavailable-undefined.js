// Generic stub for WebTorrent-family packages whose own package.json
// "browser" field marks a dependency as `false` (webpack/browserify treat
// that as "exclude entirely from the browser bundle"). Vite/Rollup doesn't
// apply that mapping (see vite.config.ts's shim plugin), so this file is
// substituted in its place instead.
//
// WebTorrent's own source is written expecting exactly this: every such
// import is guarded with `typeof X === 'function'` / `typeof X !== 'function'`
// before use (grep the relevant node_modules source for "browser exclude" to
// see it) — so exporting `undefined` for both the default and the one named
// export actually used (`Client`) reproduces real excluded-module behavior,
// it doesn't merely silence a build error.
export default undefined;
export const Client = undefined;
