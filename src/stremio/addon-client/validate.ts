import type { AddonManifest, CatalogResponse, MetaResponse, StreamResponse, SubtitleResponse } from "./types";

// Add-ons are untrusted third-party network services (docs/PROJECT_PLAN.md
// section 31) — every response gets a minimal shape check before the app
// trusts it, so a malformed/malicious response fails closed as an empty
// result instead of throwing deep inside a render tree.

export function isValidManifest(value: unknown): value is AddonManifest {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.name === "string" &&
    typeof m.version === "string" &&
    Array.isArray(m.types) &&
    Array.isArray(m.resources) &&
    Array.isArray(m.catalogs)
  );
}

export function isValidCatalogResponse(value: unknown): value is CatalogResponse {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as Record<string, unknown>).metas);
}

export function isValidMetaResponse(value: unknown): value is MetaResponse {
  if (!value || typeof value !== "object") return false;
  const meta = (value as Record<string, unknown>).meta;
  return !!meta && typeof meta === "object" && typeof (meta as Record<string, unknown>).id === "string";
}

export function isValidStreamResponse(value: unknown): value is StreamResponse {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as Record<string, unknown>).streams);
}

export function isValidSubtitleResponse(value: unknown): value is SubtitleResponse {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as Record<string, unknown>).subtitles);
}

export function isSafeAddonUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
