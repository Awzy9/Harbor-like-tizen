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

// Don't bother resuming (or showing in Continue Watching) into the last few
// seconds — that's "finished", not "in progress". Shared so Home's Continue
// Watching filter and the Player's resume check agree on the same cutoff.
export const RESUME_END_GUARD_SECONDS = 5;

export function isPlaybackFinished(progress: PlaybackProgress): boolean {
  return progress.position >= progress.duration - RESUME_END_GUARD_SECONDS;
}

/** Call on a timer (every 5-10s) plus pause/stop/ended — not on every timeupdate (docs/PROJECT_PLAN.md section 26). */
export function savePlaybackProgress(progress: PlaybackProgress): void {
  const all = readAll();
  all[progressKey(progress.contentId, progress.episodeId)] = progress;
  writeStorage(STORAGE_KEY, all);
}
