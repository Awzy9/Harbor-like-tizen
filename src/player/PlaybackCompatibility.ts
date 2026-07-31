export type CompatibilityVerdict = "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN";

export interface CompatibilityResult {
  verdict: CompatibilityVerdict;
  protocol: "hls" | "dash" | "direct";
  mimeType: string;
  reason?: string;
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
    return { verdict: "UNKNOWN", protocol, mimeType };
  }

  const probe = document.createElement("video");
  const support = probe.canPlayType(mimeType);

  if (support === "probably" || support === "maybe") {
    return { verdict: "SUPPORTED", protocol, mimeType };
  }

  if (protocol === "hls" || protocol === "dash") {
    // Many Tizen versions support HLS/DASH via native MSE even when
    // canPlayType() on the manifest mimetype comes back empty, so treat
    // this as unknown rather than a hard failure — see docs/PROJECT_PLAN.md
    // section 22.
    return { verdict: "UNKNOWN", protocol, mimeType, reason: "canPlayType inconclusive for adaptive streams" };
  }

  return { verdict: "UNSUPPORTED", protocol, mimeType, reason: `canPlayType("${mimeType}") = ""` };
}

function detectProtocol(url: string): CompatibilityResult["protocol"] {
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
