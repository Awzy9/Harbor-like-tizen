import { useEffect, useRef, useState } from "react";
import { TizenVideoPlayer } from "@/player/TizenVideoPlayer";
import { FocusableItem } from "@/components/FocusableItem";
import type { PlaybackState } from "@/types/player";
import "./TestPlayerScreen.css";

// This screen exists purely to validate the playback pipeline (see
// docs/PROJECT_PLAN.md section 42's "Playback Compatibility Test Suite"),
// never to demonstrate real content. The local sample is bundled under
// public/test-media/ so this screen works offline/without depending on a
// third-party sample-video host staying up; the HLS entry is an external
// well-known Apple test stream for exercising the adaptive-streaming path
// specifically (see section 22 — Chromium desktop has no native HLS, so
// expect "unsupported" there and treat real verification as TV-only).
const TEST_STREAMS = [
  { label: "WebM (local sample)", url: "./test-media/sample.webm" },
  { label: "HLS (Apple test stream)", url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8" },
];

export function TestPlayerScreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TizenVideoPlayer | null>(null);
  const [state, setState] = useState<PlaybackState>({ status: "idle", currentTime: 0, duration: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const player = new TizenVideoPlayer(containerRef.current);
    playerRef.current = player;
    const unsubscribe = player.onStateChange(setState);
    return () => {
      unsubscribe();
      player.destroy();
    };
  }, []);

  return (
    <div className="test-player-screen">
      <div className="test-player-screen__video" ref={containerRef} />
      <div className="test-player-screen__controls">
        {TEST_STREAMS.map((stream) => (
          <FocusableItem
            key={stream.url}
            id={`stream-${stream.url}`}
            className="test-player-screen__button"
            onEnter={() => playerRef.current?.load(stream.url)}
          >
            {stream.label}
          </FocusableItem>
        ))}
        <FocusableItem
          id="player-play"
          className="test-player-screen__button"
          onEnter={() => playerRef.current?.play()}
        >
          Play
        </FocusableItem>
        <FocusableItem
          id="player-pause"
          className="test-player-screen__button"
          onEnter={() => playerRef.current?.pause()}
        >
          Pause
        </FocusableItem>
      </div>
      <p className="text-dim">
        status: {state.status} · {Math.round(state.currentTime)}s / {Math.round(state.duration)}s
        {state.error ? ` · error: ${state.error}` : ""}
      </p>
    </div>
  );
}
