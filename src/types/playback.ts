import type { Subtitle } from "@/stremio/addon-client/types";

export interface PlaybackProgress {
  contentId: string;
  episodeId?: string;
  position: number;
  duration: number;
  updatedAt: number;
}

export interface ResolvedStream {
  url?: string;
  type?: string;
  name?: string;
  title?: string;
  quality?: string;
  behaviorHints?: Record<string, unknown>;
  subtitles?: Subtitle[];
  addonId: string;
}
