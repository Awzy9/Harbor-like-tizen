import type { AggregatedSubtitle } from "@/stremio/subtitles/SubtitleAggregator";
import { detectSubtitleFormat, srtToVtt } from "@/stremio/subtitles/srtToVtt";
import type { SubtitleTrackInfo } from "@/types/player";

export class UnsupportedSubtitleFormatError extends Error {
  constructor(url: string) {
    super(`Subtitle at ${url} is not in a supported format (only WebVTT/SRT are converted)`);
    this.name = "UnsupportedSubtitleFormatError";
  }
}

/**
 * Fetches a subtitle add-ons pointed us at and turns it into something
 * <track> can actually render. Samsung's HTML5 video only understands
 * WebVTT natively (docs/PROJECT_PLAN.md section 23), so SRT gets converted;
 * anything else (ASS/SSA, etc.) throws rather than silently showing nothing.
 */
export async function loadSubtitleTrack(subtitle: AggregatedSubtitle): Promise<SubtitleTrackInfo> {
  const response = await fetch(subtitle.url);
  if (!response.ok) throw new Error(`Failed to fetch subtitle: HTTP ${response.status}`);

  const content = await response.text();
  const format = detectSubtitleFormat(subtitle.url, content);

  let vttContent: string;
  if (format === "vtt") {
    vttContent = content;
  } else if (format === "srt") {
    vttContent = srtToVtt(content);
  } else {
    throw new UnsupportedSubtitleFormatError(subtitle.url);
  }

  const blob = new Blob([vttContent], { type: "text/vtt" });
  return {
    id: subtitle.id,
    label: `${subtitle.lang} (${subtitle.source})`,
    language: subtitle.lang,
    vttUrl: URL.createObjectURL(blob),
  };
}
