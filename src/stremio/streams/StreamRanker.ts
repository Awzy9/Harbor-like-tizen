import type { ResolvedStream } from "@/types/playback";
import type { DeviceCapabilities } from "@/tizen/deviceCapabilities";

// Scoring per docs/PROJECT_PLAN.md section 28. Deliberately simple and
// text-heuristic-based since add-ons don't provide structured
// quality/HDR/codec fields — this is a rough sort order, not a guarantee,
// and is configurable by editing these weights rather than the algorithm.
const SCORES = {
  directUrl: 10,
  // Torrent streams need peer discovery (and browsers have no DHT — see
  // TorrentStreamManager) before a single byte plays, so a direct HTTP
  // stream of the same quality is ranked above it whenever both exist.
  torrent: 4,
  quality4k: 5,
  quality1080p: 3,
  quality720p: 2,
  hdrSupported: 4,
  subtitlesAvailable: 1,
  codecConfirmedSupported: 2,
  // Only applied when the device has *explicitly* reported the parsed codec
  // as unsupported — text-parsed codec hints are best-effort, so this isn't
  // a hard filter (spec section 4: warn, don't just hide), just enough of a
  // penalty that a safer bet ranks above it when one exists.
  codecConfirmedUnsupported: -15,
} as const;

const CODEC_PATTERNS: Array<[RegExp, keyof DeviceCapabilities["codecs"]]> = [
  [/\b(hevc|h\.?265|x265)\b/i, "hevc"],
  [/\bav1\b/i, "av1"],
  [/\bvp9\b/i, "vp9"],
  [/\b(h\.?264|x264|avc)\b/i, "h264"],
];

/** Best-effort codec label parsed from a stream's free-text name/title — add-ons don't provide a structured codec field. */
export function detectCodecHint(text: string): keyof DeviceCapabilities["codecs"] | undefined {
  for (const [pattern, codec] of CODEC_PATTERNS) {
    if (pattern.test(text)) return codec;
  }
  return undefined;
}

/** Best-effort HDR label parsed from a stream's free-text name/title. */
export function detectHdrHint(text: string): boolean {
  return /\b(hdr10\+?|hdr|dolby ?vision|dv)\b/i.test(text);
}

function streamText(stream: ResolvedStream): string {
  return `${stream.name ?? ""} ${stream.title ?? ""}`;
}

/**
 * Scores one stream against (optional) device capabilities. Exported
 * directly so the UI can compute "is this the top-ranked stream?" for a
 * RECOMMENDED badge without re-implementing the ranking logic.
 */
export function scoreStream(stream: ResolvedStream, capabilities?: DeviceCapabilities): number {
  let score = stream.protocol === "torrent" ? SCORES.torrent : SCORES.directUrl;

  if (stream.quality === "4K") score += SCORES.quality4k;
  else if (stream.quality === "1080p") score += SCORES.quality1080p;
  else if (stream.quality === "720p") score += SCORES.quality720p;

  const text = streamText(stream);

  if (detectHdrHint(text) && (!capabilities || capabilities.supportsHDR10)) {
    score += SCORES.hdrSupported;
  }

  const codecHint = detectCodecHint(text);
  if (codecHint && capabilities) {
    score += capabilities.codecs[codecHint] ? SCORES.codecConfirmedSupported : SCORES.codecConfirmedUnsupported;
  }

  if (stream.subtitles && stream.subtitles.length > 0) score += SCORES.subtitlesAvailable;

  return score;
}

/** Highest-ranked first. Stable sort — equal-score streams keep add-on/aggregation order. */
export function rankStreams(streams: ResolvedStream[], capabilities?: DeviceCapabilities): ResolvedStream[] {
  return streams
    .map((stream, index) => ({ stream, index, score: scoreStream(stream, capabilities) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.stream);
}
