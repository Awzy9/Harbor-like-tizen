// Thin feature-detection layer. window.tizen / window.webapis only exist
// inside the Tizen WebKit runtime on a real TV or the Samsung TV Simulator —
// everywhere else (Chrome during development) they are undefined, so every
// other module in src/tizen/ must go through isTizen() before touching them.

export function isTizen(): boolean {
  return typeof window !== "undefined" && window.tizen !== undefined;
}

export function getTizenGlobal(): TizenGlobal | undefined {
  return window.tizen;
}
