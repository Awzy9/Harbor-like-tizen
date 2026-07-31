// Structured playback error taxonomy (docs/PROJECT_PLAN.md section 6) —
// replaces free-text error strings so the UI can show a real, actionable
// message ("this codec isn't supported") instead of "Playback error", and
// so PlaybackFallbackManager can decide "try the next stream" from a
// category rather than pattern-matching text.
export type PlaybackErrorCategory =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "UNSUPPORTED_CODEC"
  | "UNSUPPORTED_CONTAINER"
  | "MANIFEST_ERROR"
  | "HLS_ERROR"
  | "DASH_ERROR"
  | "MEDIA_ERROR"
  | "SOURCE_UNAVAILABLE"
  | "TORRENT_ERROR"
  | "SUBTITLE_ERROR"
  | "AUDIO_ERROR"
  | "UNKNOWN_ERROR";

export interface PlaybackError {
  category: PlaybackErrorCategory;
  /** Plain-language, user-facing explanation — safe to render directly. */
  message: string;
  /** Raw technical detail (codec string, HTTP status, hls.js error code) for logs/Diagnostics, not meant for the main UI. */
  detail?: string;
}

const USER_MESSAGES: Record<PlaybackErrorCategory, string> = {
  NETWORK_ERROR: "The stream could not be reached. Check your network connection or try another source.",
  TIMEOUT: "This source took too long to respond.",
  HTTP_ERROR: "The source returned an error.",
  UNSUPPORTED_CODEC: "This stream's video codec isn't supported on this TV.",
  UNSUPPORTED_CONTAINER: "This stream's file format isn't supported on this TV.",
  MANIFEST_ERROR: "The stream's playlist could not be read.",
  HLS_ERROR: "There was a problem with this HLS stream.",
  DASH_ERROR: "There was a problem with this DASH stream.",
  MEDIA_ERROR: "Playback failed unexpectedly.",
  SOURCE_UNAVAILABLE: "This source is no longer available.",
  TORRENT_ERROR: "This torrent source could not be played.",
  SUBTITLE_ERROR: "Subtitles could not be loaded for this stream.",
  AUDIO_ERROR: "This stream's audio track could not be played.",
  UNKNOWN_ERROR: "Unable to play this stream.",
};

export function createPlaybackError(category: PlaybackErrorCategory, detail?: string): PlaybackError {
  return { category, message: USER_MESSAGES[category], detail };
}
