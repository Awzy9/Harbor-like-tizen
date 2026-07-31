import { useEffect, useRef, useState } from "react";
import { TizenVideoPlayer } from "@/player/TizenVideoPlayer";
import { FocusableItem } from "@/components/FocusableItem";
import { TEST_STREAMS } from "@/player/testStreams";
import type { PlaybackState } from "@/types/player";
import "./TestPlayerScreen.css";

// This screen exists purely to validate the playback pipeline (see
// docs/PROJECT_PLAN.md section 42's "Playback Compatibility Test Suite"),
// never to demonstrate real content — see testStreams.ts for what each entry
// is and why. It won't find torrent peers in a network-restricted sandbox,
// but is a genuine, legal, real-world torrent for testing on actual TV
// hardware.

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
        {TEST_STREAMS.map((stream) => {
          const key = stream.kind === "url" ? stream.url : stream.infoHash;
          return (
            <FocusableItem
              key={key}
              id={`stream-${key}`}
              className="test-player-screen__button"
              onEnter={() =>
                stream.kind === "torrent"
                  ? playerRef.current?.loadTorrent(stream.infoHash, undefined, stream.sources)
                  : playerRef.current?.load(stream.url)
              }
            >
              {stream.label}
            </FocusableItem>
          );
        })}
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
        {state.error ? ` · error: [${state.error.category}] ${state.error.message}` : ""}
      </p>
    </div>
  );
}
