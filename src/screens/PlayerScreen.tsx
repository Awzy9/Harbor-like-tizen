import { useEffect, useRef, useState } from "react";
import { PlaybackFallbackManager, type FallbackStatus } from "@/player/PlaybackFallbackManager";
import { FocusableItem } from "@/components/FocusableItem";
import { useBackHandler } from "@/navigation/FocusManager";
import { subscribeToRemote } from "@/tizen/remote";
import { useNavigationStore, type NextEpisodeRef } from "@/state/navigationStore";
import type { PlaybackState, AudioTrackInfo } from "@/types/player";
import type { ResolvedStream } from "@/types/playback";
import { getPlaybackProgress, savePlaybackProgress, isPlaybackFinished } from "@/storage/playbackProgress";
import { getSeekInterval } from "@/storage/playbackSettings";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import { addonClient } from "@/stremio/addon-client/addonClientInstance";
import { aggregateSubtitles, type AggregatedSubtitle } from "@/stremio/subtitles/SubtitleAggregator";
import { loadSubtitleTrack } from "@/player/SubtitleManager";
import "./PlayerScreen.css";

interface PlayerScreenProps {
  /** Ranked fallback queue — streams[0] is the user's chosen stream (see StreamSelectionScreen). */
  streams: ResolvedStream[];
  addonUrl: string;
  contentId: string;
  episodeId?: string;
  title: string;
  type: string;
  poster?: string;
  nextEpisode?: NextEpisodeRef;
}

const PROGRESS_SAVE_INTERVAL_MS = 7000;
const NEXT_EPISODE_COUNTDOWN_SECONDS = 8;
// Spec sections 17/37: an OLED TV shouldn't have a bright, static control
// bar burned into the panel during long playback — hide it after a few
// seconds of no remote input, and bring it straight back on any keypress.
const CONTROLS_HIDE_DELAY_MS = 5000;

type Overlay = "none" | "subtitles" | "audio";
type Status = Pick<PlaybackState, "status" | "error">;

export function PlayerScreen({ streams, addonUrl, contentId, episodeId, title, type, poster, nextEpisode }: PlayerScreenProps) {
  // Read once per mount — the only place this preference can change is
  // Settings, which isn't reachable while the player is on screen.
  const [seekStepSeconds] = useState(getSeekInterval);
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<PlaybackFallbackManager | null>(null);
  // Only status/error live in React state — they change rarely (on real
  // transitions). currentTime/duration update several times a second via
  // timeupdate; routing those through React state would re-render the whole
  // control row on every tick, which is exactly the kind of thing that
  // stutters on TV hardware. The progress bar/clock below are updated via
  // direct DOM writes in the onTimeUpdate subscription instead (see the
  // effect below) — same fix as src/navigation for the same reason.
  const [status, setStatus] = useState<Status>({ status: "idle" });
  const [fallbackStatus, setFallbackStatus] = useState<FallbackStatus | undefined>(undefined);
  // Which stream in the queue is actually loaded right now — tracked
  // separately from `streams[0]` because PlaybackFallbackManager may have
  // moved on to a later candidate. Read via ref inside the save-progress
  // paths so those closures (created once, at mount) see the current value.
  const [currentStream, setCurrentStream] = useState<ResolvedStream>(streams[0]);
  const currentStreamRef = useRef(currentStream);
  currentStreamRef.current = currentStream;
  const hasResumedRef = useRef(false);
  const goTo = useNavigationStore((s) => s.goTo);
  const goBack = useNavigationStore((s) => s.goBack);

  const progressFillRef = useRef<HTMLDivElement>(null);
  const timeTextRef = useRef<HTMLSpanElement>(null);

  const [overlay, setOverlay] = useState<Overlay>("none");
  const [subtitles, setSubtitles] = useState<AggregatedSubtitle[] | undefined>(undefined);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | undefined>(undefined);
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const activeVttUrlRef = useRef<string | undefined>(undefined);

  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<number | undefined>(undefined);
  const nextEpisodeDismissedRef = useRef(false);

  const [controlsVisible, setControlsVisible] = useState(true);

  // Only auto-hides while actually playing with nothing else open — pausing
  // or opening the subtitles/audio panel or the next-episode prompt keeps
  // the controls up, since those are moments the user is deliberately
  // engaging with the player, not idly watching.
  useEffect(() => {
    const idle = status.status === "playing" && overlay === "none" && nextEpisodeCountdown === undefined;
    if (!idle) {
      setControlsVisible(true);
      return;
    }

    let hideTimer: ReturnType<typeof setTimeout>;
    const scheduleHide = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
    };
    scheduleHide();

    const unsubscribe = subscribeToRemote((action) => {
      if (action === "back") return; // handled by useBackHandler — shouldn't also "wake" the controls
      setControlsVisible(true);
      scheduleHide();
    });

    return () => {
      clearTimeout(hideTimer);
      unsubscribe();
    };
  }, [status.status, overlay, nextEpisodeCountdown]);

  useBackHandler(() => {
    if (overlay !== "none") {
      setOverlay("none");
      return;
    }
    if (nextEpisodeCountdown !== undefined) {
      dismissNextEpisode();
      return;
    }
    // Step back to Stream Selection (per the navigation stack — see
    // navigationStore.ts); only if there's genuinely nowhere to go back to
    // (e.g. this player was somehow reached directly) fall back to Home.
    if (!goBack()) goTo({ name: "home" });
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const manager = new PlaybackFallbackManager(containerRef.current, streams);
    managerRef.current = manager;
    hasResumedRef.current = false;

    const unsubscribeStatus = manager.videoPlayer.onStatusChange(setStatus);

    const unsubscribeTime = manager.videoPlayer.onTimeUpdate(({ currentTime, duration }) => {
      if (progressFillRef.current) {
        progressFillRef.current.style.width = `${duration > 0 ? (currentTime / duration) * 100 : 0}%`;
      }
      if (timeTextRef.current) {
        timeTextRef.current.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
      }

      if (!hasResumedRef.current && duration > 0) {
        hasResumedRef.current = true;
        // Audio tracks are only enumerable once the media has metadata.
        setAudioTracks(manager.videoPlayer.listAudioTracks());
      }
    });

    const unsubscribeFallback = manager.onFallback((fbStatus) => {
      setFallbackStatus(fbStatus);
      if (fbStatus.phase === "trying") setCurrentStream(fbStatus.stream);
    });

    const saved = getPlaybackProgress(contentId, episodeId);
    const resumeSeconds = saved && saved.position > 0 && !isPlaybackFinished(saved) ? saved.position : 0;
    manager.start(resumeSeconds);

    return () => {
      unsubscribeStatus();
      unsubscribeTime();
      unsubscribeFallback();
      const finalState = manager.videoPlayer.getState();
      if (finalState.duration > 0) {
        savePlaybackProgress({
          contentId,
          episodeId,
          position: finalState.currentTime,
          duration: finalState.duration,
          updatedAt: Date.now(),
          addonUrl: currentStreamRef.current.addonId,
          type,
          title,
          poster,
        });
      }
      manager.destroy();
      if (activeVttUrlRef.current) URL.revokeObjectURL(activeVttUrlRef.current);
    };
    // Only re-runs if this component instance is reused for a different title
    // (it isn't — App.tsx keys the Player screen by contentId/episodeId so a
    // new title always remounts fresh); intentionally not re-running on every
    // `streams` prop identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const s = managerRef.current?.videoPlayer.getState();
      if (s && s.duration > 0) {
        savePlaybackProgress({
          contentId,
          episodeId,
          position: s.currentTime,
          duration: s.duration,
          updatedAt: Date.now(),
          addonUrl: currentStreamRef.current.addonId,
          type,
          title,
          poster,
        });
      }
    }, PROGRESS_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [contentId, episodeId, type, title, poster]);

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

  function returnToStreamSelection() {
    goTo({ name: "streamSelect", addonUrl, type, id: contentId, title, poster, nextEpisode });
  }

  async function openSubtitlesOverlay() {
    setOverlay("subtitles");
    if (subtitles === undefined) {
      const result = await aggregateSubtitles(addonManager.list(), addonClient, type, contentId, currentStream.subtitles);
      setSubtitles(result);
    }
  }

  async function selectSubtitle(subtitle: AggregatedSubtitle | undefined) {
    setOverlay("none");
    setActiveSubtitleId(subtitle?.id);

    if (!subtitle) {
      managerRef.current?.videoPlayer.setSubtitle(undefined);
      return;
    }

    try {
      const track = await loadSubtitleTrack(subtitle);
      if (activeVttUrlRef.current) URL.revokeObjectURL(activeVttUrlRef.current);
      activeVttUrlRef.current = track.vttUrl;
      managerRef.current?.videoPlayer.setSubtitle(track);
    } catch (err) {
      console.warn("[PlayerScreen] failed to load subtitle", err);
    }
  }

  function seekBy(deltaSeconds: number) {
    const s = managerRef.current?.videoPlayer.getState();
    if (!s) return;
    managerRef.current?.videoPlayer.seek(Math.max(0, Math.min(s.duration, s.currentTime + deltaSeconds)));
  }

  if (fallbackStatus?.phase === "exhausted") {
    return (
      <div className="player-screen player-screen--failed">
        <h1>Unable to find a playable source.</h1>
        {fallbackStatus.lastError && <p className="text-dim">{fallbackStatus.lastError.message}</p>}
        <div className="player-screen__failed-actions">
          <FocusableItem id="player-try-another" autoFocus onEnter={returnToStreamSelection}>
            Try Another Stream
          </FocusableItem>
          <FocusableItem id="player-return" onEnter={() => goTo({ name: "home" })}>
            Return
          </FocusableItem>
        </div>
      </div>
    );
  }

  return (
    <div className="player-screen">
      <div className="player-screen__video" ref={containerRef} />
      <div className={`player-screen__overlay${controlsVisible ? "" : " player-screen__overlay--hidden"}`}>
        <h1 className="player-screen__title">{title}</h1>

        <div className="player-screen__progress-bar">
          <div className="player-screen__progress-fill" ref={progressFillRef} />
        </div>
        <p className="text-dim">
          <span ref={timeTextRef}>0:00 / 0:00</span>
        </p>
        {fallbackStatus?.phase === "retrying" && (
          <p className="player-screen__fallback-banner" role="status">
            Unable to play this source. Trying another source…
          </p>
        )}

        <div className="player-screen__controls">
          <FocusableItem id="player-seek-back" onEnter={() => seekBy(-seekStepSeconds)}>
            « {seekStepSeconds}s
          </FocusableItem>
          <FocusableItem
            id="player-play-pause"
            autoFocus
            onEnter={() => (status.status === "playing" ? managerRef.current?.videoPlayer.pause() : managerRef.current?.videoPlayer.play())}
          >
            {status.status === "playing" ? "Pause" : "Play"}
          </FocusableItem>
          <FocusableItem id="player-seek-forward" onEnter={() => seekBy(seekStepSeconds)}>
            {seekStepSeconds}s »
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
                    managerRef.current?.videoPlayer.setAudio(track);
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
