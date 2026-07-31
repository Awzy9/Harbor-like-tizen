import type { AudioTrackInfo, PlaybackState, SubtitleTrackInfo } from "@/types/player";
import { checkPlaybackCompatibility } from "./PlaybackCompatibility";
import { listAudioTracks, selectAudioTrack } from "./AudioManager";

export type PlaybackStateListener = (state: PlaybackState) => void;
export type TimeUpdateListener = (time: { currentTime: number; duration: number }) => void;

/**
 * Thin wrapper around HTML5 <video> — the first-pass playback backend per
 * docs/PROJECT_PLAN.md section 20. Deliberately does NOT pull in hls.js or
 * dash.js yet: Tizen's WebKit has native HLS support on most TV generations,
 * so a dedicated MSE/DASH backend only gets added once a real stream proves
 * native playback insufficient (section 22).
 *
 * Status changes (loading/playing/paused/ended/error) and time updates are
 * deliberately separate subscriptions: `timeupdate` fires several times a
 * second, and a naive "one listener gets everything" design means every
 * control on screen re-renders on every tick just to redraw a progress bar.
 * `onStatusChange` only fires on real state transitions; `onTimeUpdate` fires
 * on every tick for callers (the Player screen) that want to update a
 * progress bar/clock via direct DOM writes instead of React state.
 */
export class TizenVideoPlayer {
  private readonly video: HTMLVideoElement;
  private statusListeners = new Set<PlaybackStateListener>();
  private timeListeners = new Set<TimeUpdateListener>();
  private state: PlaybackState = { status: "idle", currentTime: 0, duration: 0 };

  constructor(container: HTMLElement) {
    this.video = document.createElement("video");
    this.video.style.width = "100%";
    this.video.style.height = "100%";
    this.video.playsInline = true;
    container.appendChild(this.video);

    this.video.addEventListener("loadstart", () => this.setStatus({ status: "loading" }));
    this.video.addEventListener("playing", () => this.setStatus({ status: "playing" }));
    this.video.addEventListener("pause", () => this.setStatus({ status: "paused" }));
    this.video.addEventListener("ended", () => this.setStatus({ status: "ended" }));
    this.video.addEventListener("error", () =>
      this.setStatus({ status: "error", error: describeMediaError(this.video.error) }),
    );
    this.video.addEventListener("timeupdate", () => this.updateTime());
  }

  /** Fires only on status/error transitions — not on every timeupdate tick. */
  onStatusChange(listener: PlaybackStateListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Fires on every timeupdate tick (several times a second). Prefer direct DOM writes over React state in the listener. */
  onTimeUpdate(listener: TimeUpdateListener): () => void {
    this.timeListeners.add(listener);
    return () => this.timeListeners.delete(listener);
  }

  /**
   * Convenience combined subscription for callers that don't care about
   * render cost (e.g. the developer-only Test Player screen) — fires on
   * both status and time changes with the full merged state.
   */
  onStateChange(listener: PlaybackStateListener): () => void {
    const unsubStatus = this.onStatusChange(listener);
    const unsubTime = this.onTimeUpdate(() => listener(this.state));
    return () => {
      unsubStatus();
      unsubTime();
    };
  }

  getState(): PlaybackState {
    return this.state;
  }

  load(url: string): void {
    const compatibility = checkPlaybackCompatibility(url);
    if (compatibility.verdict === "UNSUPPORTED") {
      this.setStatus({ status: "error", error: `Unsupported stream: ${compatibility.reason}` });
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
    this.setStatus({ status: "idle", currentTime: 0, duration: 0 });
  }

  destroy(): void {
    this.stop();
    this.statusListeners.clear();
    this.timeListeners.clear();
    this.video.remove();
  }

  private setStatus(partial: Partial<PlaybackState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.statusListeners) listener(this.state);
  }

  private updateTime(): void {
    this.state = { ...this.state, currentTime: this.video.currentTime, duration: this.video.duration || 0 };
    const time = { currentTime: this.state.currentTime, duration: this.state.duration };
    for (const listener of this.timeListeners) listener(time);
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
