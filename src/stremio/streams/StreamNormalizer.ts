import type { Stream } from "@/stremio/addon-client/types";
import type { ResolvedStream } from "@/types/playback";

/**
 * Converts protocol Stream objects into playable ResolvedStreams. Direct
 * http(s) URLs and torrent infoHash streams are both kept — the latter play
 * via WebTorrent (see TorrentStreamManager). YouTube-ID-only streams are
 * still dropped: YouTube embedding is out of scope by design
 * (docs/PROJECT_PLAN.md section 50), and there's no other way to play them.
 */
export function normalizeStreams(streams: Stream[], addonId: string): ResolvedStream[] {
  return streams
    .filter((s) => (typeof s.url === "string" && s.url.length > 0) || typeof s.infoHash === "string")
    .map((s) => ({
      protocol: s.url ? ("http" as const) : ("torrent" as const),
      url: s.url,
      infoHash: s.infoHash,
      fileIdx: s.fileIdx,
      sources: s.sources,
      name: s.name,
      title: s.title,
      quality: detectQualityLabel(`${s.name ?? ""} ${s.title ?? ""}`),
      behaviorHints: s.behaviorHints,
      subtitles: s.subtitles,
      addonId,
    }));
}

const QUALITY_PATTERNS: Array<[RegExp, string]> = [
  [/\b(2160p|4k|uhd)\b/i, "4K"],
  [/\b1080p\b/i, "1080p"],
  [/\b720p\b/i, "720p"],
  [/\b480p\b/i, "480p"],
];

/** Best-effort quality label parsed from a stream's free-text name/title — add-ons don't provide a structured quality field. */
export function detectQualityLabel(text: string): string | undefined {
  for (const [pattern, label] of QUALITY_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return undefined;
}
