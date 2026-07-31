// Shared between TestPlayerScreen and the Diagnostics screen's "Test
// HLS"/"Test DASH" buttons, so the same known-good reference streams are
// used in exactly one place rather than duplicated. The local sample is
// bundled under public/test-media/ so it works offline. HLS/DASH entries
// are well-known public reference test streams for exercising the
// adaptive-streaming (hls.js/dash.js) paths specifically — desktop Chrome
// has no native HLS and essentially no browser has native DASH, so both
// exercise the MSE-library fallback here, which is also what most TVs will
// use for DASH (Tizen has no native DASH either). The torrent entry is
// WebTorrent's own long-standing public demo torrent (Sintel, a Blender
// Foundation open movie) with WSS trackers attached — the only kind of
// tracker browser WebTorrent can use (see TorrentStreamManager).
export type TestStream =
  | { label: string; kind: "url"; protocol: "direct" | "hls" | "dash"; url: string }
  | { label: string; kind: "torrent"; infoHash: string; sources: string[] };

export const TEST_STREAMS: TestStream[] = [
  { label: "WebM (local sample)", kind: "url", protocol: "direct", url: "./test-media/sample.webm" },
  {
    label: "HLS (Apple test stream)",
    kind: "url",
    protocol: "hls",
    url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8",
  },
  {
    label: "DASH (Akamai test stream)",
    kind: "url",
    protocol: "dash",
    url: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
  },
  {
    label: "Torrent (Sintel)",
    kind: "torrent",
    infoHash: "08ada5a7a6183aae1e09d831df6748d566095a10",
    sources: ["tracker:wss://tracker.btorrent.xyz", "tracker:wss://tracker.openwebtorrent.com"],
  },
];
