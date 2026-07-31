import { TizenVideoPlayer } from "./TizenVideoPlayer";
import type { ResolvedStream } from "@/types/playback";
import type { PlaybackState } from "@/types/player";

export type FallbackStatus =
  | { phase: "trying"; stream: ResolvedStream; attempt: number; total: number }
  | { phase: "playing" }
  | { phase: "retrying"; failedStream: ResolvedStream; nextStream: ResolvedStream; attempt: number }
  | { phase: "exhausted"; attempts: number; lastError: PlaybackState["error"] };

export type FallbackListener = (status: FallbackStatus) => void;

/** Spec: "Recommended maximum: 3 automatic attempts" — after that, stop and let the user choose. */
const MAX_ATTEMPTS = 3;

/**
 * Wraps TizenVideoPlayer with automatic cross-stream fallback (spec section
 * 5 "Automatic Playback Fallback"): given a ranked list of streams for the
 * same title, plays the first, and on a *fatal* playback error (not a
 * recoverable one hls.js/dash.js already absorbed internally) automatically
 * stops it and tries the next-ranked stream — up to MAX_ATTEMPTS streams
 * total, never retrying one already tried this session. The starting resume
 * position (e.g. from Continue Watching) is preserved across attempts;
 * re-seeking to "where attempt 1 died" wouldn't be meaningful since a
 * different source's encoding/segments have no relation to the last one's
 * timeline.
 *
 * Deliberately only reacts to failures *before* a stream reaches "playing" —
 * a mid-playback stall/error after a stream already started successfully is
 * a different problem (buffer health, not source selection) and is left to
 * surface as a normal error rather than silently jumping sources under the
 * user.
 */
export class PlaybackFallbackManager {
  private readonly player: TizenVideoPlayer;
  private readonly queue: ResolvedStream[];
  private attempted = 0;
  private resumePosition = 0;
  private destroyed = false;
  private listeners = new Set<FallbackListener>();

  constructor(container: HTMLElement, rankedStreams: ResolvedStream[]) {
    this.player = new TizenVideoPlayer(container);
    this.queue = rankedStreams;
  }

  /** The underlying player, for callers that need direct control (seek/pause/subtitles/audio) once a stream is playing. */
  get videoPlayer(): TizenVideoPlayer {
    return this.player;
  }

  onFallback(listener: FallbackListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(resumeSeconds = 0): void {
    this.resumePosition = resumeSeconds;
    this.playNext();
  }

  private playNext(): void {
    const stream = this.queue[this.attempted];
    if (!stream) {
      this.emit({ phase: "exhausted", attempts: this.attempted, lastError: undefined });
      return;
    }
    this.attempted += 1;
    this.emit({ phase: "trying", stream, attempt: this.attempted, total: Math.min(this.queue.length, MAX_ATTEMPTS) });

    const unsubscribeStatus = this.player.onStatusChange((state) => {
      if (state.status === "playing") {
        unsubscribeStatus();
        this.emit({ phase: "playing" });
      } else if (state.status === "error") {
        unsubscribeStatus();
        this.handleFailure(stream, state.error);
      }
    });

    if (stream.protocol === "torrent" && stream.infoHash) {
      this.player.loadTorrent(stream.infoHash, stream.fileIdx, stream.sources);
    } else if (stream.url) {
      this.player.load(stream.url);
    } else {
      unsubscribeStatus();
      this.handleFailure(stream, undefined);
      return;
    }

    this.player.play();
    if (this.resumePosition > 0) {
      const unsubscribeTime = this.player.onTimeUpdate(({ duration }) => {
        if (duration <= 0) return;
        unsubscribeTime();
        this.player.seek(this.resumePosition);
      });
    }
  }

  private handleFailure(stream: ResolvedStream, error: PlaybackState["error"]): void {
    if (this.destroyed) return;
    if (this.attempted >= MAX_ATTEMPTS || this.attempted >= this.queue.length) {
      this.emit({ phase: "exhausted", attempts: this.attempted, lastError: error });
      return;
    }
    const nextStream = this.queue[this.attempted];
    this.emit({ phase: "retrying", failedStream: stream, nextStream, attempt: this.attempted + 1 });
    // Deferred rather than called inline: an error event handler is already
    // mid-dispatch here, and immediately reassigning video.src again from
    // inside it is a real-world source of a native <video> element getting
    // confused about which load it's actually processing (observed directly:
    // three failures fired back-to-back this way left the *third*, valid
    // stream reporting a bogus MEDIA_ERR_SRC_NOT_SUPPORTED). Letting the
    // current event finish first before starting the next load avoids it.
    setTimeout(() => this.playNext(), 0);
  }

  private emit(status: FallbackStatus): void {
    if (this.destroyed) return;
    for (const listener of this.listeners) listener(status);
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
    this.player.destroy();
  }
}
