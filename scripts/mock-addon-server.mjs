#!/usr/bin/env node
// A minimal, self-contained Stremio-protocol add-on used only for local
// development and testing (docs/PROJECT_PLAN.md section 46: "Testing
// Stremio Protocol Independently"). It serves fabricated catalog/meta
// entries and points its one "stream" at the sample clip already bundled
// under public/test-media/, so the full pipeline — install add-on -> browse
// catalog -> view details -> resolve streams -> play — can be exercised
// end-to-end without depending on any real, third-party content source.
//
// Usage: node scripts/mock-addon-server.mjs [port]
// Then in the app's Add-ons screen, install: http://localhost:<port>/manifest.json

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 7777);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_VIDEO_PATH = path.join(__dirname, "..", "public", "test-media", "sample.webm");

const MOVIES = [
  { id: "mock:1", type: "movie", name: "Test Pattern Feature", description: "A short animated test-pattern clip, used only to validate the playback pipeline.", releaseInfo: "2026" },
  { id: "mock:2", type: "movie", name: "Focus Ring Diaries", description: "Another mock entry to prove catalog aggregation across multiple items.", releaseInfo: "2026" },
];

// A minimal 2-episode series, for exercising the episode list / next-episode flow.
const SERIES = [
  {
    id: "mock-series:1",
    type: "series",
    name: "Focus Ring: The Series",
    description: "A mock series fixture used to test episode navigation and the next-episode flow.",
    releaseInfo: "2026",
    videos: [
      { id: "mock-series:1:1:1", title: "Pilot", season: 1, episode: 1 },
      { id: "mock-series:1:1:2", title: "The Sequel", season: 1, episode: 2 },
    ],
  },
];

const SAMPLE_SUBTITLE_SRT = `1
00:00:00,000 --> 00:00:02,000
Hello from a mock subtitle track.

2
00:00:02,000 --> 00:00:04,000
This line proves SRT-to-WebVTT conversion works.
`;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function notFound(res) {
  json(res, 404, { error: "not found" });
}

// HTML5 video seeking depends on the server supporting byte-range requests
// (every real content host does this) — without it, <video> can only ever
// report a seekable range of [0,0] no matter how well-formed the file is.
function serveVideoWithRangeSupport(req, res, filePath) {
  const { size } = fs.statSync(filePath);
  const range = req.headers.range;

  const headers = {
    "Content-Type": "video/webm",
    "Access-Control-Allow-Origin": "*",
    "Accept-Ranges": "bytes",
  };

  if (!range) {
    res.writeHead(200, { ...headers, "Content-Length": size });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  const start = match?.[1] ? Number(match[1]) : 0;
  const end = match?.[2] ? Number(match[2]) : size - 1;

  res.writeHead(206, {
    ...headers,
    "Content-Range": `bytes ${start}-${end}/${size}`,
    "Content-Length": end - start + 1,
  });
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

// Episode ids are "<seriesId>:<season>:<episode>" — find the series that owns one.
function seriesForEpisodeId(episodeId) {
  return SERIES.find((s) => s.videos.some((v) => v.id === episodeId));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const segments = url.pathname.split("/").filter(Boolean);
  const [resource, type, rest] = segments;

  if (resource === "manifest.json") {
    return json(res, 200, {
      id: "org.harbor-like-tizen.mock-addon",
      name: "Mock Dev Add-on",
      version: "1.0.0",
      description: "Local-only test fixture — never a real content source.",
      types: ["movie", "series"],
      resources: ["catalog", "meta", "stream", "subtitles"],
      catalogs: [
        { type: "movie", id: "mock-movies", name: "Mock Movies", extra: [{ name: "search", isRequired: false }] },
        { type: "series", id: "mock-series", name: "Mock Series", extra: [{ name: "search", isRequired: false }] },
      ],
    });
  }

  if (resource === "catalog") {
    const searchMatch = url.pathname.match(/search=([^/]+)\.json$/);
    const source = type === "series" ? SERIES : MOVIES;
    let metas = source;
    if (searchMatch) {
      const query = decodeURIComponent(searchMatch[1]).toLowerCase();
      metas = source.filter((m) => m.name.toLowerCase().includes(query));
    }
    return json(res, 200, { metas: metas.map(({ videos, ...preview }) => preview) });
  }

  if (resource === "meta") {
    const id = decodeURIComponent(rest?.replace(/\.json$/, "") ?? "");
    const source = type === "series" ? SERIES : MOVIES;
    const item = source.find((m) => m.id === id);
    if (!item) return notFound(res);
    return json(res, 200, { meta: { ...item, background: undefined, runtime: "4 sec" } });
  }

  if (resource === "stream") {
    const id = decodeURIComponent(rest?.replace(/\.json$/, "") ?? "");
    const isKnownMovie = MOVIES.some((m) => m.id === id);
    const isKnownEpisode = type === "series" && seriesForEpisodeId(id);
    if (!isKnownMovie && !isKnownEpisode) return notFound(res);
    return json(res, 200, {
      streams: [{ url: `http://localhost:${PORT}/sample.webm`, name: "Mock Dev Add-on", title: "Local sample clip (WebM, 4s)" }],
    });
  }

  if (resource === "subtitles") {
    const id = decodeURIComponent(rest?.replace(/\.json$/, "") ?? "");
    // Only the first movie has a subtitle fixture — proves subtitles are per-title, not universal.
    if (id === "mock:1") {
      return json(res, 200, { subtitles: [{ id: "mock-sub-en", url: `http://localhost:${PORT}/subtitle-sample.srt`, lang: "en" }] });
    }
    return json(res, 200, { subtitles: [] });
  }

  if (resource === "subtitle-sample.srt") {
    const payload = SAMPLE_SUBTITLE_SRT;
    res.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*", "Content-Length": Buffer.byteLength(payload) });
    res.end(payload);
    return;
  }

  if (resource === "sample.webm") {
    if (!fs.existsSync(SAMPLE_VIDEO_PATH)) return notFound(res);
    return serveVideoWithRangeSupport(req, res, SAMPLE_VIDEO_PATH);
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`Mock add-on running at http://localhost:${PORT}/manifest.json`);
});
