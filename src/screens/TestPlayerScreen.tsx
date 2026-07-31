import { useEffect, useRef, useState } from "react";
import { TizenVideoPlayer } from "@/player/TizenVideoPlayer";
import { FocusableItem } from "@/components/FocusableItem";
import type { PlaybackState } from "@/types/player";
import "./TestPlayerScreen.css";

// This screen exists purely to validate the playback pipeline (see
// docs/PROJECT_PLAN.md section 42's "Playback Compatibility Test Suite"),
// never to demonstrate real content. The local sample is bundled under
// public/test-media/ so this screen works offline/without depending on a
// third-party sample-video host staying up. HLS/DASH entries are
// well-known public reference test streams for exercising the
// adaptive-streaming (hls.js/dash.js) paths specifically — desktop Chrome
// has no native HLS and essentially no browser has native DASH, so both
// exercise the MSE-library fallback here, which is also what most TVs will
// use for DASH (Tizen has no native DASH either). The torrent entry is
// WebTorrent's own long-standing public demo torrent (Sintel, a Blender
// Foundation open movie) with WSS trackers attached — the only kind of
// tracker browser WebTorrent can use (see TorrentStreamManager). It won't
// find peers in a network-restricted sandbox, but is a genuine, legal,
// real-world torrent for testing on actual TV hardware.
const TEST_STREAMS: Array<
  | { label: string; kind: "url"; url: string }
  | { label: string; kind: "torrent"; infoHash: string; sources: string[] }
> = [
  { label: "WebM (local sample)", kind: "url", url: "./test-media/sample.webm" },
  { label: "HLS (Apple test stream)", kind: "url", url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8" },
  { label: "DASH (Akamai test stream)", kind: "url", url: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd" },
  {
    label: "Torrent (Sintel)",
    kind: "torrent",
    infoHash: "08ada5a7a6183aae1e09d831df6748d566095a10",
    sources: ["tracker:wss://tracker.btorrent.xyz", "tracker:wss://tracker.openwebtorrent.com"],
  },
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
        {state.error ? ` · error: ${state.error}` : ""}
      </p>
    </div>
  );
}
