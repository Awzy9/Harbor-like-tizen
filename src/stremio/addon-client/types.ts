// Types for the public Stremio add-on protocol resources: manifest, catalog,
// meta, stream, subtitles. Field shapes follow the community-documented
// protocol (stremio-addon-sdk / stremio.github.io) — see docs/PROJECT_PLAN.md
// section 11. This module only models the *interoperability* protocol, not
// Stremio's private account/auth backend (see src/stremio/account/).

export interface AddonCatalogDescriptor {
  type: string;
  id: string;
  name?: string;
  extra?: Array<{ name: string; isRequired?: boolean; options?: string[] }>;
}

export interface AddonManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  logo?: string;
  background?: string;
  types: string[];
  resources: Array<string | { name: string; types: string[]; idPrefixes?: string[] }>;
  catalogs: AddonCatalogDescriptor[];
  idPrefixes?: string[];
  behaviorHints?: Record<string, unknown>;
}

export interface MetaVideo {
  id: string;
  title: string;
  season?: number;
  episode?: number;
  released?: string;
  thumbnail?: string;
  overview?: string;
}

export interface MetaPreview {
  id: string;
  type: string;
  name: string;
  poster?: string;
  posterShape?: "square" | "poster" | "landscape";
  description?: string;
  releaseInfo?: string;
  genres?: string[];
  imdbRating?: string;
}

export interface Meta extends MetaPreview {
  background?: string;
  runtime?: string;
  cast?: string[];
  director?: string[];
  videos?: MetaVideo[];
}

export interface Subtitle {
  id: string;
  url: string;
  lang: string;
}

export interface Stream {
  url?: string;
  ytId?: string;
  infoHash?: string;
  fileIdx?: number;
  name?: string;
  title?: string;
  description?: string;
  subtitles?: Subtitle[];
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    filename?: string;
    [key: string]: unknown;
  };
}

export interface CatalogResponse {
  metas: MetaPreview[];
}

export interface MetaResponse {
  meta: Meta;
}

export interface StreamResponse {
  streams: Stream[];
}

export interface SubtitleResponse {
  subtitles: Subtitle[];
}
