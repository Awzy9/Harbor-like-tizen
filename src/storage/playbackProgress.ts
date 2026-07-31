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

/** Call on a timer (every 5-10s) plus pause/stop/ended — not on every timeupdate (docs/PROJECT_PLAN.md section 26). */
export function savePlaybackProgress(progress: PlaybackProgress): void {
  const all = readAll();
  all[progressKey(progress.contentId, progress.episodeId)] = progress;
  writeStorage(STORAGE_KEY, all);
}
