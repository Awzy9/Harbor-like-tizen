export type CompatibilityVerdict = "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN";
export type StreamProtocol = "hls" | "dash" | "torrent" | "direct";

export interface CompatibilityResult {
  verdict: CompatibilityVerdict;
  protocol: StreamProtocol;
  mimeType: string;
  reason?: string;
  /** true when native <video> playback should be tried before reaching for hls.js/dash.js. */
  preferNative: boolean;
}

/**
 * Cheap pre-flight check before handing a URL to <video>. This is
 * deliberately shallow — protocol/extension sniffing plus canPlayType — not
 * a real prober that opens a connection. It exists so the UI can say
 * "probably unsupported" before a 10-second buffering spinner does it for
 * us, not to be authoritative; UNKNOWN just means "try it and see."
 */
export function checkPlaybackCompatibility(url: string): CompatibilityResult {
  const protocol = detectProtocol(url);
  const mimeType = mimeTypeFor(protocol, url);

  if (typeof document === "undefined") {
    return { verdict: "UNKNOWN", protocol, mimeType, preferNative: true };
  }

  const probe = document.createElement("video");
  const support = probe.canPlayType(mimeType);
  const preferNative = support === "probably" || support === "maybe";

  if (preferNative) {
    return { verdict: "SUPPORTED", protocol, mimeType, preferNative: true };
  }

  if (protocol === "hls" || protocol === "dash") {
    // Native canPlayType() coming back empty doesn't mean unplayable for
    // adaptive streams — Tizen has native HLS on many TV generations even
    // when this probe is inconclusive (docs/PROJECT_PLAN.md section 22),
    // and where native support genuinely is missing, TizenVideoPlayer falls
    // back to hls.js/dash.js (MSE-based), so this is UNKNOWN rather than a
    // hard failure either way.
    return { verdict: "UNKNOWN", protocol, mimeType, preferNative: false, reason: "canPlayType inconclusive for adaptive streams" };
  }

  return { verdict: "UNSUPPORTED", protocol, mimeType, preferNative: false, reason: `canPlayType("${mimeType}") = ""` };
}

function detectProtocol(url: string): StreamProtocol {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".m3u8")) return "hls";
  if (path.endsWith(".mpd")) return "dash";
  return "direct";
}

function mimeTypeFor(protocol: CompatibilityResult["protocol"], url: string): string {
  if (protocol === "hls") return "application/vnd.apple.mpegurl";
  if (protocol === "dash") return "application/dash+xml";

  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".mkv")) return "video/x-matroska";
  return "video/mp4";
}
