import { readStorage, writeStorage } from "./localStorage";

// Spec section 18: seek interval should be a user preference, not a fixed
// constant — some people scrub in small steps, others want to jump far on a
// 2-hour movie.
export const SEEK_INTERVAL_OPTIONS = [5, 10, 15, 30] as const;
export type SeekIntervalSeconds = (typeof SEEK_INTERVAL_OPTIONS)[number];

const DEFAULT_SEEK_INTERVAL: SeekIntervalSeconds = 10;
const STORAGE_KEY = "seekIntervalSeconds";

export function getSeekInterval(): SeekIntervalSeconds {
  const value = readStorage<number>(STORAGE_KEY);
  return (SEEK_INTERVAL_OPTIONS as readonly number[]).includes(value as number)
    ? (value as SeekIntervalSeconds)
    : DEFAULT_SEEK_INTERVAL;
}

export function setSeekInterval(seconds: SeekIntervalSeconds): void {
  writeStorage(STORAGE_KEY, seconds);
}

/** Cycles to the next option, wrapping around — used by the Settings screen's single-item cycler control. */
export function nextSeekInterval(current: SeekIntervalSeconds): SeekIntervalSeconds {
  const index = SEEK_INTERVAL_OPTIONS.indexOf(current);
  return SEEK_INTERVAL_OPTIONS[(index + 1) % SEEK_INTERVAL_OPTIONS.length];
}
