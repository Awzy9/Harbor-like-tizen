import { getDeviceInfo } from "./device";

export interface CodecSupport {
  h264: boolean;
  hevc: boolean;
  vp9: boolean;
  av1: boolean;
}

export interface AudioCodecSupport {
  aac: boolean;
  ac3: boolean;
  eac3: boolean;
  opus: boolean;
}

export interface NetworkCapabilities {
  online: boolean;
  /** Only populated where the Network Information API exists (Tizen WebKit/Chromium; not Safari). */
  effectiveType?: string;
  downlinkMbps?: number;
  rttMs?: number;
}

export interface DeviceCapabilities {
  isTizen: boolean;
  tizenVersion?: string;
  /** Only populated on real Samsung TV firmware — Samsung's model APIs have no generic-browser equivalent. */
  model?: string;
  screenWidth: number;
  screenHeight: number;
  codecs: CodecSupport;
  audioCodecs: AudioCodecSupport;
  supportsHLS: boolean;
  supportsDASH: boolean;
  /** Best-effort via the CSS Media Queries dynamic-range feature — not all platforms expose this accurately. */
  supportsHDR10: boolean;
  /** No reliable browser-level API exists for this; a codec canPlayType() probe is a weak signal at best. Treat as "maybe" only. */
  supportsDolbyVisionUnconfirmed: boolean;
  network: NetworkCapabilities;
}

/**
 * Real, feature-detected device capabilities — never a hardcoded table of
 * "what Samsung TVs support." Different Tizen versions/models genuinely
 * differ (docs/PROJECT_PLAN.md section 20), so every field here is either
 * read from the platform directly or probed via canPlayType()/matchMedia(),
 * the same mechanism PlaybackCompatibility already uses for its per-stream
 * checks. Cheap to call repeatedly, but stable per session — call once and
 * reuse rather than re-probing on every stream.
 */
export function getDeviceCapabilities(): DeviceCapabilities {
  const device = getDeviceInfo();
  const probe = typeof document !== "undefined" ? document.createElement("video") : undefined;

  return {
    isTizen: device.isTizen,
    tizenVersion: device.platformVersion,
    model: getSamsungModel(),
    screenWidth: typeof screen !== "undefined" ? screen.width : 0,
    screenHeight: typeof screen !== "undefined" ? screen.height : 0,
    codecs: getCodecSupport(probe),
    audioCodecs: getAudioCodecSupport(probe),
    supportsHLS: canPlay(probe, "application/vnd.apple.mpegurl"),
    // No real browser/TV has native DASH support — "supported" here means
    // "MSE is available, so the dash.js fallback in TizenVideoPlayer can
    // work," not "the platform decodes DASH manifests natively."
    supportsDASH: typeof MediaSource !== "undefined",
    supportsHDR10: supportsHdr(),
    supportsDolbyVisionUnconfirmed: canPlay(probe, 'video/mp4; codecs="dvhe.05.01"') || canPlay(probe, 'video/mp4; codecs="dvh1.05.01"'),
    network: getNetworkCapabilities(),
  };
}

function canPlay(probe: HTMLVideoElement | undefined, mimeType: string): boolean {
  if (!probe) return false;
  const result = probe.canPlayType(mimeType);
  return result === "probably" || result === "maybe";
}

function getCodecSupport(probe: HTMLVideoElement | undefined): CodecSupport {
  return {
    h264: canPlay(probe, 'video/mp4; codecs="avc1.42E01E"'),
    hevc: canPlay(probe, 'video/mp4; codecs="hvc1.1.6.L93.90"') || canPlay(probe, 'video/mp4; codecs="hev1.1.6.L93.90"'),
    vp9: canPlay(probe, 'video/webm; codecs="vp9"'),
    av1: canPlay(probe, 'video/mp4; codecs="av01.0.05M.08"'),
  };
}

function getAudioCodecSupport(probe: HTMLVideoElement | undefined): AudioCodecSupport {
  return {
    aac: canPlay(probe, 'audio/mp4; codecs="mp4a.40.2"'),
    ac3: canPlay(probe, 'audio/mp4; codecs="ac-3"'),
    eac3: canPlay(probe, 'audio/mp4; codecs="ec-3"'),
    opus: canPlay(probe, 'audio/webm; codecs="opus"'),
  };
}

function supportsHdr(): boolean {
  if (typeof matchMedia === "undefined") return false;
  try {
    return matchMedia("(dynamic-range: high)").matches || matchMedia("(video-dynamic-range: high)").matches;
  } catch {
    // Older WebKit engines can throw on an unrecognized media feature rather than just not matching it.
    return false;
  }
}

function getSamsungModel(): string | undefined {
  try {
    return window.webapis?.productinfo?.getRealModel?.() ?? window.webapis?.productinfo?.getModel?.();
  } catch (err) {
    console.warn("[deviceCapabilities] Samsung productinfo query failed", err);
    return undefined;
  }
}

function getNetworkCapabilities(): NetworkCapabilities {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const connection = typeof navigator === "undefined" ? undefined : navigator.connection;
  if (!connection) return { online };

  return {
    online,
    effectiveType: connection.effectiveType,
    downlinkMbps: connection.downlink,
    rttMs: connection.rtt,
  };
}
