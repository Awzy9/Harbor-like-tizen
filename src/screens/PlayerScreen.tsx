import { useEffect, useRef, useState } from "react";
import { TizenVideoPlayer } from "@/player/TizenVideoPlayer";
import { FocusableItem } from "@/components/FocusableItem";
import { useBackHandler } from "@/navigation/FocusManager";
import { useNavigationStore, type NextEpisodeRef } from "@/state/navigationStore";
import type { PlaybackState, AudioTrackInfo } from "@/types/player";
import type { ResolvedStream } from "@/types/playback";
import { getPlaybackProgress, savePlaybackProgress, RESUME_END_GUARD_SECONDS } from "@/storage/playbackProgress";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import { addonClient } from "@/stremio/addon-client/addonClientInstance";
import { aggregateSubtitles, type AggregatedSubtitle } from "@/stremio/subtitles/SubtitleAggregator";
import { loadSubtitleTrack } from "@/player/SubtitleManager";
import "./PlayerScreen.css";

interface PlayerScreenProps {
  stream: ResolvedStream;
  contentId: string;
  episodeId?: string;
  title: string;
  type: string;
  poster?: string;
  nextEpisode?: NextEpisodeRef;
}

const PROGRESS_SAVE_INTERVAL_MS = 7000;
const SEEK_STEP_SECONDS = 10;
const NEXT_EPISODE_COUNTDOWN_SECONDS = 8;

type Overlay = "none" | "subtitles" | "audio";
type Status = Pick<PlaybackState, "status" | "error">;

export function PlayerScreen({ stream, contentId, episodeId, title, type, poster, nextEpisode }: PlayerScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TizenVideoPlayer | null>(null);
  // Only status/error live in React state — they change rarely (on real
  // transitions). currentTime/duration update several times a second via
  // timeupdate; routing those through React state would re-render the whole
  // control row on every tick, which is exactly the kind of thing that
  // stutters on TV hardware. The progress bar/clock below are updated via
  // direct DOM writes in the onTimeUpdate subscription instead (see the
  // effect below) — same fix as src/navigation for the same reason.
  const [status, setStatus] = useState<Status>({ status: "idle" });
  const hasResumedRef = useRef(false);
  const goTo = useNavigationStore((s) => s.goTo);

  const progressFillRef = useRef<HTMLDivElement>(null);
  const timeTextRef = useRef<HTMLSpanElement>(null);

  const [overlay, setOverlay] = useState<Overlay>("none");
  const [subtitles, setSubtitles] = useState<AggregatedSubtitle[] | undefined>(undefined);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | undefined>(undefined);
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const activeVttUrlRef = useRef<string | undefined>(undefined);

  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<number | undefined>(undefined);
  const nextEpisodeDismissedRef = useRef(false);

  useBackHandler(() => {
    if (overlay !== "none") {
      setOverlay("none");
      return;
    }
    if (nextEpisodeCountdown !== undefined) {
      dismissNextEpisode();
      return;
    }
    goTo({ name: "home" });
  });

  useEffect(() => {
    if (!containerRef.current || !stream.url) return;
    const player = new TizenVideoPlayer(containerRef.current);
    playerRef.current = player;
    hasResumedRef.current = false;

    const unsubscribeStatus = player.onStatusChange(setStatus);

    const unsubscribeTime = player.onTimeUpdate(({ currentTime, duration }) => {
      if (progressFillRef.current) {
        progressFillRef.current.style.width = `${duration > 0 ? (currentTime / duration) * 100 : 0}%`;
      }
      if (timeTextRef.current) {
        timeTextRef.current.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
      }

      if (!hasResumedRef.current && duration > 0) {
        hasResumedRef.current = true;
        const saved = getPlaybackProgress(contentId, episodeId);
        if (saved && saved.position > 0 && saved.position < saved.duration - RESUME_END_GUARD_SECONDS) {
          player.seek(saved.position);
        }
        // Audio tracks are only enumerable once the media has metadata.
        setAudioTracks(player.listAudioTracks());
      }
    });

    player.load(stream.url);
    player.play();

    return () => {
      unsubscribeStatus();
      unsubscribeTime();
      const finalState = player.getState();
      if (finalState.duration > 0) {
        savePlaybackProgress({
          contentId,
          episodeId,
          position: finalState.currentTime,
          duration: finalState.duration,
          updatedAt: Date.now(),
          addonUrl: stream.addonId,
          type,
          title,
          poster,
        });
      }
      player.destroy();
      if (activeVttUrlRef.current) URL.revokeObjectURL(activeVttUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.url]);

  useEffect(() => {
    const interval = setInterval(() => {
      const s = playerRef.current?.getState();
      if (s && s.duration > 0) {
        savePlaybackProgress({
          contentId,
          episodeId,
          position: s.currentTime,
          duration: s.duration,
          updatedAt: Date.now(),
          addonUrl: stream.addonId,
          type,
          title,
          poster,
        });
      }
    }, PROGRESS_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [contentId, episodeId, stream.addonId, type, title, poster]);

  useEffect(() => {
    if (status.status === "ended" && nextEpisode && !nextEpisodeDismissedRef.current) {
      setNextEpisodeCountdown(NEXT_EPISODE_COUNTDOWN_SECONDS);
    }
  }, [status.status, nextEpisode]);

  useEffect(() => {
    if (nextEpisodeCountdown === undefined) return;
    if (nextEpisodeCountdown <= 0) {
      goToNextEpisode();
      return;
    }
    const timer = setTimeout(() => setNextEpisodeCountdown((c) => (c !== undefined ? c - 1 : undefined)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextEpisodeCountdown]);

  function goToNextEpisode() {
    if (!nextEpisode) return;
    goTo({ name: "streamSelect", addonUrl: nextEpisode.addonUrl, type: nextEpisode.type, id: nextEpisode.id, title: nextEpisode.title });
  }

  function dismissNextEpisode() {
    nextEpisodeDismissedRef.current = true;
    setNextEpisodeCountdown(undefined);
  }

  async function openSubtitlesOverlay() {
    setOverlay("subtitles");
    if (subtitles === undefined) {
      const result = await aggregateSubtitles(addonManager.list(), addonClient, type, contentId, stream.subtitles);
      setSubtitles(result);
    }
  }

  async function selectSubtitle(subtitle: AggregatedSubtitle | undefined) {
    setOverlay("none");
    setActiveSubtitleId(subtitle?.id);

    if (!subtitle) {
      playerRef.current?.setSubtitle(undefined);
      return;
    }

    try {
      const track = await loadSubtitleTrack(subtitle);
      if (activeVttUrlRef.current) URL.revokeObjectURL(activeVttUrlRef.current);
      activeVttUrlRef.current = track.vttUrl;
      playerRef.current?.setSubtitle(track);
    } catch (err) {
      console.warn("[PlayerScreen] failed to load subtitle", err);
    }
  }

  function seekBy(deltaSeconds: number) {
    const s = playerRef.current?.getState();
    if (!s) return;
    playerRef.current?.seek(Math.max(0, Math.min(s.duration, s.currentTime + deltaSeconds)));
  }

  return (
    <div className="player-screen">
      <div className="player-screen__video" ref={containerRef} />
      <div className="player-screen__overlay">
        <h1 className="player-screen__title">{title}</h1>

        <div className="player-screen__progress-bar">
          <div className="player-screen__progress-fill" ref={progressFillRef} />
        </div>
        <p className="text-dim">
          <span ref={timeTextRef}>0:00 / 0:00</span>
          {status.status === "error" ? ` · error: ${status.error}` : ""}
        </p>

        <div className="player-screen__controls">
          <FocusableItem id="player-seek-back" onEnter={() => seekBy(-SEEK_STEP_SECONDS)}>
            « {SEEK_STEP_SECONDS}s
          </FocusableItem>
          <FocusableItem
            id="player-play-pause"
            autoFocus
            onEnter={() => (status.status === "playing" ? playerRef.current?.pause() : playerRef.current?.play())}
          >
            {status.status === "playing" ? "Pause" : "Play"}
          </FocusableItem>
          <FocusableItem id="player-seek-forward" onEnter={() => seekBy(SEEK_STEP_SECONDS)}>
            {SEEK_STEP_SECONDS}s »
          </FocusableItem>
          <FocusableItem id="player-subtitles" onEnter={openSubtitlesOverlay}>
            Subtitles
          </FocusableItem>
          {audioTracks.length > 1 && (
            <FocusableItem id="player-audio" onEnter={() => setOverlay("audio")}>
              Audio
            </FocusableItem>
          )}
        </div>
      </div>

      {overlay === "subtitles" && (
        <div className="player-screen__panel">
          <h2>Subtitles</h2>
          {subtitles === undefined ? (
            <p className="text-dim">Loading…</p>
          ) : (
            <ul className="player-screen__panel-list">
              <li>
                <FocusableItem id="subtitle-off" autoFocus selected={activeSubtitleId === undefined} onEnter={() => selectSubtitle(undefined)}>
                  Off
                </FocusableItem>
              </li>
              {subtitles.length === 0 && <p className="text-dim">No subtitles available.</p>}
              {subtitles.map((sub) => (
                <li key={sub.id}>
                  <FocusableItem
                    id={`subtitle-${sub.id}`}
                    selected={activeSubtitleId === sub.id}
                    onEnter={() => selectSubtitle(sub)}
                  >
                    {sub.lang} <span className="text-dim">· {sub.source}</span>
                  </FocusableItem>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {overlay === "audio" && (
        <div className="player-screen__panel">
          <h2>Audio</h2>
          <ul className="player-screen__panel-list">
            {audioTracks.map((track) => (
              <li key={track.id}>
                <FocusableItem
                  id={`audio-${track.id}`}
                  autoFocus
                  onEnter={() => {
                    playerRef.current?.setAudio(track);
                    setOverlay("none");
                  }}
                >
                  {track.label}
                </FocusableItem>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextEpisodeCountdown !== undefined && nextEpisode && (
        <div className="player-screen__next-episode">
          <h2>Up Next</h2>
          <p className="player-screen__next-episode-title">{nextEpisode.title}</p>
          <div className="player-screen__next-episode-actions">
            <FocusableItem id="next-episode-play" autoFocus onEnter={goToNextEpisode}>
              Play ({nextEpisodeCountdown}s)
            </FocusableItem>
            <FocusableItem id="next-episode-cancel" onEnter={dismissNextEpisode}>
              Cancel
            </FocusableItem>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
