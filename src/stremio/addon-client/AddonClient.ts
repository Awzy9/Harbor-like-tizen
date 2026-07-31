import type { AddonManifest, Meta, MetaPreview, Stream, Subtitle } from "./types";
import {
  isSafeAddonUrl,
  isValidCatalogResponse,
  isValidManifest,
  isValidMetaResponse,
  isValidStreamResponse,
  isValidSubtitleResponse,
} from "./validate";

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB — a catalog/meta response has no business being bigger.

export class AddonRequestError extends Error {
  constructor(
    message: string,
    public readonly addonUrl: string,
  ) {
    super(message);
    this.name = "AddonRequestError";
  }
}

/**
 * Talks to a single add-on over the Stremio protocol (manifest / catalog /
 * meta / stream / subtitles). One instance is stateless and reusable across
 * add-ons — CatalogAggregator/AddonManager own the per-addon bookkeeping.
 *
 * Every add-on is an untrusted third-party HTTP endpoint (see
 * docs/PROJECT_PLAN.md section 31): requests are timed out, responses are
 * size-capped and shape-validated, and a failure here must never throw past
 * the caller — callers get `undefined`/`[]` plus a thrown AddonRequestError
 * that callers are expected to catch per add-on (never let one broken add-on
 * take down a whole catalog aggregation).
 */
export class AddonClient {
  constructor(private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS) {}

  async loadManifest(transportUrl: string): Promise<AddonManifest> {
    const data = await this.fetchJson(transportUrl);
    if (!isValidManifest(data)) {
      throw new AddonRequestError("Invalid manifest shape", transportUrl);
    }
    return data;
  }

  async getCatalog(
    manifest: AddonManifest,
    transportUrl: string,
    type: string,
    catalogId: string,
    extra?: Record<string, string>,
  ): Promise<MetaPreview[]> {
    if (!manifest.catalogs.some((c) => c.type === type && c.id === catalogId)) {
      throw new AddonRequestError(`Add-on does not declare catalog ${type}/${catalogId}`, transportUrl);
    }
    const url = buildResourceUrl(transportUrl, "catalog", type, catalogId, extra);
    const data = await this.fetchJson(url);
    if (!isValidCatalogResponse(data)) {
      throw new AddonRequestError("Invalid catalog response shape", url);
    }
    return data.metas;
  }

  async getMeta(manifest: AddonManifest, transportUrl: string, type: string, id: string): Promise<Meta> {
    this.assertResourceSupported(manifest, "meta", type, transportUrl);
    const url = buildResourceUrl(transportUrl, "meta", type, id);
    const data = await this.fetchJson(url);
    if (!isValidMetaResponse(data)) {
      throw new AddonRequestError("Invalid meta response shape", url);
    }
    return data.meta;
  }

  async getStreams(manifest: AddonManifest, transportUrl: string, type: string, id: string): Promise<Stream[]> {
    this.assertResourceSupported(manifest, "stream", type, transportUrl);
    const url = buildResourceUrl(transportUrl, "stream", type, id);
    const data = await this.fetchJson(url);
    if (!isValidStreamResponse(data)) {
      throw new AddonRequestError("Invalid stream response shape", url);
    }
    return data.streams;
  }

  async getSubtitles(manifest: AddonManifest, transportUrl: string, type: string, id: string): Promise<Subtitle[]> {
    this.assertResourceSupported(manifest, "subtitles", type, transportUrl);
    const url = buildResourceUrl(transportUrl, "subtitles", type, id);
    const data = await this.fetchJson(url);
    if (!isValidSubtitleResponse(data)) {
      throw new AddonRequestError("Invalid subtitles response shape", url);
    }
    return data.subtitles;
  }

  private assertResourceSupported(manifest: AddonManifest, resource: string, type: string, transportUrl: string): void {
    const supported = manifest.resources.some((r) =>
      typeof r === "string" ? r === resource : r.name === resource && r.types.includes(type),
    );
    if (!supported) {
      throw new AddonRequestError(`Add-on does not declare resource "${resource}" for type "${type}"`, transportUrl);
    }
  }

  private async fetchJson(url: string): Promise<unknown> {
    if (!isSafeAddonUrl(url)) {
      throw new AddonRequestError("Refusing non-http(s) add-on URL", url);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
      if (!response.ok) {
        throw new AddonRequestError(`HTTP ${response.status}`, url);
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
        throw new AddonRequestError("Response exceeds max allowed size", url);
      }

      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) {
        throw new AddonRequestError("Response exceeds max allowed size", url);
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new AddonRequestError("Response was not valid JSON", url);
      }
    } catch (err) {
      if (err instanceof AddonRequestError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new AddonRequestError(`Timed out after ${this.timeoutMs}ms`, url);
      }
      throw new AddonRequestError(err instanceof Error ? err.message : "Unknown fetch error", url);
    } finally {
      clearTimeout(timer);
    }
  }
}

function buildResourceUrl(
  transportUrl: string,
  resource: string,
  type: string,
  id: string,
  extra?: Record<string, string>,
): string {
  const base = transportUrl.replace(/manifest\.json$/, "").replace(/\/$/, "");
  const encodedId = encodeURIComponent(id);
  let path = `${base}/${resource}/${type}/${encodedId}.json`;

  if (extra && Object.keys(extra).length > 0) {
    const extraSegment = Object.entries(extra)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");
    path = `${base}/${resource}/${type}/${encodedId}/${extraSegment}.json`;
  }

  return path;
}
