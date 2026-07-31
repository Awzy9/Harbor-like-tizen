import type Hls from "hls.js";
import type { MediaPlayerClass } from "dashjs";
import type { AudioTrackInfo, PlaybackState, SubtitleTrackInfo } from "@/types/player";
import { createPlaybackError, type PlaybackError } from "@/types/playbackError";
import { checkPlaybackCompatibility } from "./PlaybackCompatibility";
import { listAudioTracks, selectAudioTrack } from "./AudioManager";
import { TorrentStreamManager } from "./TorrentStreamManager";

export type PlaybackStateListener = (state: PlaybackState) => void;
export type TimeUpdateListener = (time: { currentTime: number; duration: number }) => void;

/**
 * Thin wrapper around HTML5 <video> — the first-pass playback backend per
 * docs/PROJECT_PLAN.md section 20. Native playback is always tried first for
 * HLS (Tizen's WebKit has native HLS support on most TV generations —
 * section 22); hls.js/dash.js (both MSE-based) are the fallback for
 * platforms without native support (virtually all of them, for DASH).
 *
 * Both libraries are loaded via dynamic import() rather than a static
 * top-level import: statically importing dash.js in particular pushed the
 * app's single JS bundle from ~190KB to ~1.6MB, meaning every screen —
 * Home, Search, Settings, none of which ever touch video — paid the cost of
 * downloading and parsing a full DASH player on a TV's limited CPU. With
 * dynamic import, that cost is only paid the moment a stream actually needs
 * it, and normal HTTP/native-HLS playback (the common case) never fetches
 * either library at all.
 *
 * infoHash-based (torrent) Stremio streams go through loadTorrent() instead,
 * which hands the same <video> element to TorrentStreamManager/WebTorrent
 * rather than setting .src directly — see that module for why it's a
 * best-effort path in a browser context.
 *
 * Status changes (loading/playing/paused/ended/error) and time updates are
 * deliberately separate subscriptions: `timeupdate` fires several times a
 * second, and a naive "one listener gets everything" design means every
 * control on screen re-renders on every tick just to redraw a progress bar.
 * `onStatusChange` only fires on real state transitions; `onTimeUpdate` fires
 * on every tick for callers (the Player screen) that want to update a
 * progress bar/clock via direct DOM writes instead of React state.
 */
let instanceCounter = 0;

export class TizenVideoPlayer {
  private readonly video: HTMLVideoElement;
  /** Unique per instance so setSubtitleStyle()'s ::cue rule only ever targets this player's own <video>, never another one that might exist briefly during a screen transition. */
  private readonly videoClass = `tizen-video-${instanceCounter++}`;
  private readonly cueStyleEl: HTMLStyleElement;
  private statusListeners = new Set<PlaybackStateListener>();
  private timeListeners = new Set<TimeUpdateListener>();
  private state: PlaybackState = { status: "idle", currentTime: 0, duration: 0 };
  private hls: Hls | undefined;
  private dash: MediaPlayerClass | undefined;
  private torrent: TorrentStreamManager | undefined;
  /** Bumped on every load()/stop() so a slow, superseded dynamic import can't attach itself after a newer load() has already moved on. */
  private loadToken = 0;
  private mseBackendLoading = false;
  private pendingPlay = false;

  constructor(container: HTMLElement) {
    this.video = document.createElement("video");
    this.video.style.width = "100%";
    this.video.style.height = "100%";
    this.video.playsInline = true;
    this.video.classList.add(this.videoClass);
    container.appendChild(this.video);

    this.cueStyleEl = document.createElement("style");
    container.appendChild(this.cueStyleEl);

    this.video.addEventListener("loadstart", () => this.setStatus({ status: "loading" }));
    this.video.addEventListener("playing", () => this.setStatus({ status: "playing" }));
    this.video.addEventListener("pause", () => this.setStatus({ status: "paused" }));
    this.video.addEventListener("ended", () => this.setStatus({ status: "ended" }));
    this.video.addEventListener("error", () =>
      this.setStatus({ status: "error", error: classifyMediaError(this.video.error) }),
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

  /** Exposed only for backends that need to drive the <video> element directly (see TorrentStreamManager). */
  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  load(url: string): void {
    this.destroyBackends();
    const token = this.loadToken;

    const compatibility = checkPlaybackCompatibility(url);
    if (compatibility.verdict === "UNSUPPORTED") {
      this.setStatus({ status: "error", error: createPlaybackError("UNSUPPORTED_CONTAINER", compatibility.reason) });
      return;
    }

    // Cheap, library-free check for whether it's even worth fetching
    // hls.js/dash.js — both are MSE-based, so no MediaSource means neither
    // could work regardless of what their own (much heavier) isSupported()
    // checks would say.
    const mseAvailable = typeof MediaSource !== "undefined";

    if (compatibility.protocol === "hls" && !compatibility.preferNative && mseAvailable) {
      this.loadWithHls(url, token).catch((err: unknown) => this.reportMseLoadError(token, "HLS", err));
      return;
    }

    if (compatibility.protocol === "dash" && mseAvailable) {
      // DASH has essentially no native browser/TV support, unlike HLS —
      // always route it through dash.js rather than trying <video> first.
      this.loadWithDash(url, token).catch((err: unknown) => this.reportMseLoadError(token, "DASH", err));
      return;
    }

    this.video.src = url;
    this.video.load();
  }

  /**
   * Plays an infoHash-based Stremio stream via WebTorrent instead of
   * <video>.src — see TorrentStreamManager for why this is a best-effort
   * path (no DHT in-browser) rather than a guaranteed-to-work one.
   */
  loadTorrent(infoHash: string, fileIdx: number | undefined, sources: string[] | undefined): void {
    this.destroyBackends();
    const token = this.loadToken;
    this.setStatus({ status: "loading" });

    const manager = new TorrentStreamManager();
    this.torrent = manager;
    manager.render(this.video, infoHash, fileIdx, sources).catch((err: unknown) => {
      if (token !== this.loadToken) return; // superseded by a newer load()/stop()
      const message = err instanceof Error ? err.message : String(err);
      const category = message.startsWith("Timed out") ? "TIMEOUT" : "TORRENT_ERROR";
      this.setStatus({ status: "error", error: createPlaybackError(category, message) });
    });
  }

  private async loadWithHls(url: string, token: number): Promise<void> {
    this.mseBackendLoading = true;
    const { default: Hls } = await import("hls.js");
    if (token !== this.loadToken) return; // superseded by a newer load()/stop() while the import was in flight

    if (!Hls.isSupported()) {
      this.mseBackendLoading = false;
      this.video.src = url;
      this.video.load();
      this.flushPendingPlay();
      return;
    }

    const hls = new Hls();
    this.hls = hls;
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return; // hls.js recovers from most non-fatal errors (segment retries, etc.) on its own
      this.setStatus({ status: "error", error: classifyHlsError(data) });
    });
    hls.loadSource(url);
    hls.attachMedia(this.video);
    this.mseBackendLoading = false;
    this.flushPendingPlay();
  }

  private async loadWithDash(url: string, token: number): Promise<void> {
    this.mseBackendLoading = true;
    const { MediaPlayer } = await import("dashjs");
    if (token !== this.loadToken) return;

    const dash = MediaPlayer().create();
    this.dash = dash;
    dash.on("error", (e: unknown) => {
      this.setStatus({ status: "error", error: createPlaybackError("DASH_ERROR", describeDashError(e)) });
    });
    dash.initialize(this.video, url, false);
    this.mseBackendLoading = false;
    this.flushPendingPlay();
  }

  /** Catches anything the dynamic import itself throws (e.g. the chunk failing to fetch/parse) — otherwise that's a silent unhandled rejection with no UI feedback at all. */
  private reportMseLoadError(token: number, backend: "HLS" | "DASH", err: unknown): void {
    this.mseBackendLoading = false;
    if (token !== this.loadToken) return;
    const message = err instanceof Error ? err.message : String(err);
    // Failing to even fetch the hls.js/dash.js chunk is a network problem, not a stream-content problem.
    this.setStatus({ status: "error", error: createPlaybackError("NETWORK_ERROR", `${backend} backend failed to load: ${message}`) });
  }

  private flushPendingPlay(): void {
    if (this.pendingPlay) {
      this.pendingPlay = false;
      this.play();
    }
  }

  private destroyBackends(): void {
    this.loadToken += 1;
    this.mseBackendLoading = false;
    if (this.hls) {
      this.hls.destroy();
      this.hls = undefined;
    }
    if (this.dash) {
      this.dash.destroy();
      this.dash = undefined;
    }
    if (this.torrent) {
      this.torrent.destroy();
      this.torrent = undefined;
    }
  }

  play(): void {
    // A dynamic-imported HLS/DASH backend may still be attaching — calling
    // video.play() before that finishes would just reject with nothing to
    // play, and once attached nothing auto-starts since we don't set
    // autoplay. Defer instead so it actually plays once ready.
    if (this.mseBackendLoading) {
      this.pendingPlay = true;
      return;
    }
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
    this.pendingPlay = false;
    this.video.pause();
  }

  seek(seconds: number): void {
    this.video.currentTime = seconds;
  }

  setVolume(value: number): void {
    this.video.volume = Math.max(0, Math.min(1, value));
  }

  /**
   * Adds/enables a WebVTT subtitle track. Pass undefined to turn subtitles
   * off. `delaySeconds` shifts every cue's timing after the track loads
   * (positive = subtitles appear later) — there's no <track> attribute for
   * this, so it's done by mutating each VTTCue directly once the browser has
   * parsed them.
   */
  setSubtitle(track: SubtitleTrackInfo | undefined, delaySeconds = 0): void {
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
      if (!el.track) return;
      el.track.mode = "showing";
      if (delaySeconds !== 0 && el.track.cues) {
        for (const cue of Array.from(el.track.cues)) {
          if (cue instanceof VTTCue) {
            cue.startTime += delaySeconds;
            cue.endTime += delaySeconds;
          }
        }
      }
    });
  }

  /** Styles this player's own subtitle cues only (see videoClass) — background is a solid box behind the text, not the whole video. */
  setSubtitleStyle(fontSizeRem: number, background: boolean): void {
    const backgroundRule = background ? "rgba(0, 0, 0, 0.75)" : "transparent";
    this.cueStyleEl.textContent = `.${this.videoClass}::cue { font-size: ${fontSizeRem}rem; background: ${backgroundRule}; }`;
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
    this.destroyBackends();
    this.pendingPlay = false;
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
    this.cueStyleEl.remove();
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

/** dash.js "error" events aren't consistently shaped — sometimes {error: "download"}, sometimes {error: {code, message}} — so this digs for whatever's most useful rather than risking "[object Object]". */
function describeDashError(e: unknown): string {
  if (!e || typeof e !== "object" || !("error" in e)) return "unknown";
  const inner = (e as { error: unknown }).error;
  if (typeof inner === "string") return inner;
  if (inner && typeof inner === "object") {
    const withMessage = inner as { message?: unknown; code?: unknown };
    if (typeof withMessage.message === "string") return withMessage.message;
    if (withMessage.code !== undefined) return `code ${String(withMessage.code)}`;
  }
  return "unknown";
}

/** Maps the native <video> MediaError code to a playback error category — MEDIA_ERR_DECODE almost always means an unsupported codec, not a generic failure. */
function classifyMediaError(error: MediaError | null): PlaybackError {
  if (!error) return createPlaybackError("UNKNOWN_ERROR");
  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return createPlaybackError("MEDIA_ERROR", "Playback aborted");
    case MediaError.MEDIA_ERR_NETWORK:
      return createPlaybackError("NETWORK_ERROR", "Native <video> network error");
    case MediaError.MEDIA_ERR_DECODE:
      return createPlaybackError("UNSUPPORTED_CODEC", "Decode error — likely an unsupported codec");
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return createPlaybackError("UNSUPPORTED_CONTAINER", "Source not supported");
    default:
      return createPlaybackError("MEDIA_ERROR", `Media error code ${error.code}`);
  }
}

/** Maps an hls.js fatal ErrorData to a playback error category. hls.js's own `type`/`details` fields already distinguish network vs. media vs. manifest-parsing failures — this just translates that into our taxonomy instead of re-deriving it. */
function classifyHlsError(data: { type: string; details: string }): PlaybackError {
  if (data.details.toLowerCase().includes("manifest")) return createPlaybackError("MANIFEST_ERROR", data.details);
  if (data.type === "networkError") return createPlaybackError("NETWORK_ERROR", data.details);
  if (data.type === "mediaError") return createPlaybackError("MEDIA_ERROR", data.details);
  return createPlaybackError("HLS_ERROR", data.details);
}
