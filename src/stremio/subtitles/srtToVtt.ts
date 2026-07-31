const SRT_TIMESTAMP = /(\d{2}:\d{2}:\d{2}),(\d{3})/g;

/**
 * Converts SRT to WebVTT — the only subtitle format Samsung's HTML5 <video>
 * `<track>` element consumes natively (docs/PROJECT_PLAN.md section 23). The
 * two formats are otherwise structurally identical: WebVTT just needs a
 * header and commas-as-decimal-separators swapped for periods in timestamps.
 * ASS/SSA are NOT handled here — their styling/positioning has no VTT
 * equivalent worth attempting, so those are left to fail gracefully upstream
 * rather than mistranslated.
 */
export function srtToVtt(srt: string): string {
  const withoutBom = srt.replace(/^﻿/, "");
  const normalized = withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const withDotTimestamps = normalized.replace(SRT_TIMESTAMP, "$1.$2");
  return `WEBVTT\n\n${withDotTimestamps.trim()}\n`;
}

/** Best-effort format sniff — trusts the extension first, falls back to content since add-ons don't declare subtitle format explicitly. */
export function detectSubtitleFormat(url: string, content: string): "vtt" | "srt" | "unknown" {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".vtt")) return "vtt";
  if (path.endsWith(".srt")) return "srt";

  const trimmed = content.trimStart();
  if (trimmed.startsWith("WEBVTT")) return "vtt";
  if (/^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(trimmed)) return "srt";
  return "unknown";
}
