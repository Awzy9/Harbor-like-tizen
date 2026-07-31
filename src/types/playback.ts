import type { Subtitle } from "@/stremio/addon-client/types";

export interface PlaybackProgress {
  contentId: string;
  episodeId?: string;
  position: number;
  duration: number;
  updatedAt: number;
  // Denormalized display/resume context, saved alongside progress so
  // "Continue Watching" can render and re-enter playback without a network
  // round-trip just to look the title back up.
  addonUrl: string;
  type: string;
  title: string;
  poster?: string;
}

export interface ResolvedStream {
  /** "http" streams always have `url`; "torrent" streams always have `infoHash` — see StreamNormalizer. */
  protocol: "http" | "torrent";
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  sources?: string[];
  type?: string;
  name?: string;
  title?: string;
  quality?: string;
  behaviorHints?: Record<string, unknown>;
  subtitles?: Subtitle[];
  addonId: string;
}
