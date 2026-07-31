import type { PlaybackProgress } from "@/types/playback";
import { readStorage, writeStorage } from "./localStorage";

const STORAGE_KEY = "playbackProgress";

function progressKey(contentId: string, episodeId?: string): string {
  return episodeId ? `${contentId}:${episodeId}` : contentId;
}

function readAll(): Record<string, PlaybackProgress> {
  return readStorage<Record<string, PlaybackProgress>>(STORAGE_KEY) ?? {};
}

export function getPlaybackProgress(contentId: string, episodeId?: string): PlaybackProgress | undefined {
  return readAll()[progressKey(contentId, episodeId)];
}

export function getAllPlaybackProgress(): PlaybackProgress[] {
  return Object.values(readAll());
}

// Percentage-based rather than a flat few-second guard (docs/PROJECT_PLAN.md
// section 22): a fixed few-second cutoff is basically irrelevant for a
// 2-hour movie (only excludes the literal credits) but far too tight for a
// short clip. Shared so Home's Continue Watching filter and the Player's
// resume check agree on the same "is this basically done" definition.
const FINISHED_THRESHOLD_FRACTION = 0.9;

export function isPlaybackFinished(progress: PlaybackProgress): boolean {
  if (progress.duration <= 0) return false; // unknown duration — don't claim "finished" about something we can't measure
  return progress.position >= progress.duration * FINISHED_THRESHOLD_FRACTION;
}

/** Call on a timer (every 5-10s) plus pause/stop/ended — not on every timeupdate (docs/PROJECT_PLAN.md section 26). */
export function savePlaybackProgress(progress: PlaybackProgress): void {
  const all = readAll();
  all[progressKey(progress.contentId, progress.episodeId)] = progress;
  writeStorage(STORAGE_KEY, all);
}
