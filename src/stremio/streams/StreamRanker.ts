import type { ResolvedStream } from "@/types/playback";

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
  hdr: 4,
  subtitlesAvailable: 2,
} as const;

function scoreStream(stream: ResolvedStream): number {
  let score = stream.protocol === "torrent" ? SCORES.torrent : SCORES.directUrl;

  if (stream.quality === "4K") score += SCORES.quality4k;
  else if (stream.quality === "1080p") score += SCORES.quality1080p;
  else if (stream.quality === "720p") score += SCORES.quality720p;

  const text = `${stream.name ?? ""} ${stream.title ?? ""}`;
  if (/\bhdr\b/i.test(text)) score += SCORES.hdr;

  return score;
}

/** Highest-ranked first. Stable sort — equal-score streams keep add-on/aggregation order. */
export function rankStreams(streams: ResolvedStream[]): ResolvedStream[] {
  return streams
    .map((stream, index) => ({ stream, index, score: scoreStream(stream) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.stream);
}
