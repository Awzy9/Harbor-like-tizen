import { useEffect, useRef, useState } from "react";
import { TizenVideoPlayer } from "@/player/TizenVideoPlayer";
import { FocusableItem } from "@/components/FocusableItem";
import type { PlaybackState } from "@/types/player";
import type { ResolvedStream } from "@/types/playback";
import { getPlaybackProgress, savePlaybackProgress } from "@/storage/playbackProgress";
import "./PlayerScreen.css";

interface PlayerScreenProps {
  stream: ResolvedStream;
  contentId: string;
  episodeId?: string;
  title: string;
}

const PROGRESS_SAVE_INTERVAL_MS = 7000;
const SEEK_STEP_SECONDS = 10;
// Don't bother resuming into the last few seconds — that's "finished", not "in progress".
const RESUME_END_GUARD_SECONDS = 5;

export function PlayerScreen({ stream, contentId, episodeId, title }: PlayerScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TizenVideoPlayer | null>(null);
  const [state, setState] = useState<PlaybackState>({ status: "idle", currentTime: 0, duration: 0 });
  const hasResumedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !stream.url) return;
    const player = new TizenVideoPlayer(containerRef.current);
    playerRef.current = player;
    hasResumedRef.current = false;

    const unsubscribe = player.onStateChange((s) => {
      setState(s);

      if (!hasResumedRef.current && s.duration > 0) {
        hasResumedRef.current = true;
        const saved = getPlaybackProgress(contentId, episodeId);
        if (saved && saved.position > 0 && saved.position < saved.duration - RESUME_END_GUARD_SECONDS) {
          player.seek(saved.position);
        }
      }
    });

    player.load(stream.url);
    player.play();

    return () => {
      unsubscribe();
      const finalState = player.getState();
      if (finalState.duration > 0) {
        savePlaybackProgress({
          contentId,
          episodeId,
          position: finalState.currentTime,
          duration: finalState.duration,
          updatedAt: Date.now(),
        });
      }
      player.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.url]);

  useEffect(() => {
    const interval = setInterval(() => {
      const s = playerRef.current?.getState();
      if (s && s.duration > 0) {
        savePlaybackProgress({ contentId, episodeId, position: s.currentTime, duration: s.duration, updatedAt: Date.now() });
      }
    }, PROGRESS_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [contentId, episodeId]);

  const progressPct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="player-screen">
      <div className="player-screen__video" ref={containerRef} />
      <div className="player-screen__overlay">
        <h1 className="player-screen__title">{title}</h1>

        <div className="player-screen__progress-bar">
          <div className="player-screen__progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-dim">
          {formatTime(state.currentTime)} / {formatTime(state.duration)}
          {state.status === "error" ? ` · error: ${state.error}` : ""}
        </p>

        <div className="player-screen__controls">
          <FocusableItem id="player-seek-back" onEnter={() => playerRef.current?.seek(Math.max(0, state.currentTime - SEEK_STEP_SECONDS))}>
            « {SEEK_STEP_SECONDS}s
          </FocusableItem>
          <FocusableItem
            id="player-play-pause"
            autoFocus
            onEnter={() => (state.status === "playing" ? playerRef.current?.pause() : playerRef.current?.play())}
          >
            {state.status === "playing" ? "Pause" : "Play"}
          </FocusableItem>
          <FocusableItem
            id="player-seek-forward"
            onEnter={() => playerRef.current?.seek(Math.min(state.duration, state.currentTime + SEEK_STEP_SECONDS))}
          >
            {SEEK_STEP_SECONDS}s »
          </FocusableItem>
        </div>
      </div>
    </div>
  );
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
