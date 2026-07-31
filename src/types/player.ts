import type { PlaybackError } from "./playbackError";

export interface SubtitleTrackInfo {
  id: string;
  label: string;
  language: string;
  /** WebVTT URL — the only format <track> can consume natively (see PlaybackCompatibility). */
  vttUrl: string;
}

export interface AudioTrackInfo {
  id: string;
  label: string;
  language?: string;
}

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface PlaybackState {
  status: PlaybackStatus;
  currentTime: number;
  duration: number;
  error?: PlaybackError;
}

export type PlaybackEvent =
  | { type: "statuschange"; state: PlaybackState }
  | { type: "timeupdate"; currentTime: number; duration: number };
