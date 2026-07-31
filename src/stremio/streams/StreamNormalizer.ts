import type { Stream } from "@/stremio/addon-client/types";
import type { ResolvedStream } from "@/types/playback";

/**
 * Converts protocol Stream objects into playable ResolvedStreams. Streams
 * without a direct http(s) URL (torrent infoHash, YouTube ID) are dropped
 * rather than guessed at — this app has no torrent engine or YouTube
 * embedding by design (docs/PROJECT_PLAN.md section 50: "Do NOT initially
 * build: torrent engine"), so surfacing them would just be a dead "Play"
 * button.
 */
export function normalizeStreams(streams: Stream[], addonId: string): ResolvedStream[] {
  return streams
    .filter((s): s is Stream & { url: string } => typeof s.url === "string" && s.url.length > 0)
    .map((s) => ({
      url: s.url,
      name: s.name,
      title: s.title,
      quality: detectQualityLabel(`${s.name ?? ""} ${s.title ?? ""}`),
      behaviorHints: s.behaviorHints,
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
