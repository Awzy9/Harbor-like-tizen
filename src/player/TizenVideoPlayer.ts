import type { AudioTrackInfo, PlaybackState, SubtitleTrackInfo } from "@/types/player";
import { checkPlaybackCompatibility } from "./PlaybackCompatibility";
import { listAudioTracks, selectAudioTrack } from "./AudioManager";

export type PlaybackStateListener = (state: PlaybackState) => void;

/**
 * Thin wrapper around HTML5 <video> — the first-pass playback backend per
 * docs/PROJECT_PLAN.md section 20. Deliberately does NOT pull in hls.js or
 * dash.js yet: Tizen's WebKit has native HLS support on most TV generations,
 * so a dedicated MSE/DASH backend only gets added once a real stream proves
 * native playback insufficient (section 22).
 */
export class TizenVideoPlayer {
  private readonly video: HTMLVideoElement;
  private listeners = new Set<PlaybackStateListener>();
  private state: PlaybackState = { status: "idle", currentTime: 0, duration: 0 };

  constructor(container: HTMLElement) {
    this.video = document.createElement("video");
    this.video.style.width = "100%";
    this.video.style.height = "100%";
    this.video.playsInline = true;
    container.appendChild(this.video);

    this.video.addEventListener("loadstart", () => this.setState({ status: "loading" }));
    this.video.addEventListener("playing", () => this.setState({ status: "playing" }));
    this.video.addEventListener("pause", () => this.setState({ status: "paused" }));
    this.video.addEventListener("ended", () => this.setState({ status: "ended" }));
    this.video.addEventListener("error", () =>
      this.setState({ status: "error", error: describeMediaError(this.video.error) }),
    );
    this.video.addEventListener("timeupdate", () =>
      this.setState({ currentTime: this.video.currentTime, duration: this.video.duration || 0 }),
    );
  }

  onStateChange(listener: PlaybackStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): PlaybackState {
    return this.state;
  }

  load(url: string): void {
    const compatibility = checkPlaybackCompatibility(url);
    if (compatibility.verdict === "UNSUPPORTED") {
      this.setState({ status: "error", error: `Unsupported stream: ${compatibility.reason}` });
      return;
    }

    this.video.src = url;
    this.video.load();
  }

  play(): void {
    // play() returns a Promise that rejects with AbortError if pause() (or a
    // new load()) interrupts it before it resolves — expected under rapid
    // play/pause toggling (including React StrictMode's mount/unmount/
    // remount dance in dev), not a real playback failure worth surfacing.
    this.video.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.warn("[TizenVideoPlayer] play() failed", err);
    });
  }

  pause(): void {
    this.video.pause();
  }

  seek(seconds: number): void {
    this.video.currentTime = seconds;
  }

  setVolume(value: number): void {
    this.video.volume = Math.max(0, Math.min(1, value));
  }

  /** Adds/enables a WebVTT subtitle track. Pass undefined to turn subtitles off. */
  setSubtitle(track: SubtitleTrackInfo | undefined): void {
    for (const existing of Array.from(this.video.querySelectorAll("track"))) {
      existing.remove();
    }
    if (!track) return;

    const el = document.createElement("track");
    el.kind = "subtitles";
    el.label = track.label;
    el.srclang = track.language;
    el.src = track.vttUrl;
    el.default = true;
    this.video.appendChild(el);
    // Track elements only take effect once attached and the mode is set explicitly.
    el.addEventListener("load", () => {
      if (el.track) el.track.mode = "showing";
    });
  }

  /** Only ever reflects tracks the platform actually reports (see AudioManager) — empty on most desktop browsers. */
  listAudioTracks(): AudioTrackInfo[] {
    return listAudioTracks(this.video);
  }

  /** Selects an audio track when the platform exposes AudioTrackList (Tizen TV, not all browsers). */
  setAudio(track: AudioTrackInfo): void {
    selectAudioTrack(this.video, track.id);
  }

  stop(): void {
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.setState({ status: "idle", currentTime: 0, duration: 0 });
  }

  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.video.remove();
  }

  private setState(partial: Partial<PlaybackState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener(this.state);
  }
}

function describeMediaError(error: MediaError | null): string {
  if (!error) return "Unknown playback error";
  const codes: Record<number, string> = {
    [MediaError.MEDIA_ERR_ABORTED]: "Playback aborted",
    [MediaError.MEDIA_ERR_NETWORK]: "Network error",
    [MediaError.MEDIA_ERR_DECODE]: "Decode error (unsupported codec?)",
    [MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED]: "Source not supported",
  };
  return codes[error.code] ?? `Media error code ${error.code}`;
}
