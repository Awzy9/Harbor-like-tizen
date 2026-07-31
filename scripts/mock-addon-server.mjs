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

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments[0] === "manifest.json") {
    return json(res, 200, {
      id: "org.harbor-like-tizen.mock-addon",
      name: "Mock Dev Add-on",
      version: "1.0.0",
      description: "Local-only test fixture — never a real content source.",
      types: ["movie"],
      resources: ["catalog", "meta", "stream", "subtitles"],
      catalogs: [{ type: "movie", id: "mock-movies", name: "Mock Movies", extra: [{ name: "search", isRequired: false }] }],
    });
  }

  if (segments[0] === "catalog" && segments[1] === "movie") {
    // segments[2] is either "mock-movies.json" or "mock-movies/search=<query>.json"
    const searchMatch = url.pathname.match(/search=([^/]+)\.json$/);
    let metas = MOVIES;
    if (searchMatch) {
      const query = decodeURIComponent(searchMatch[1]).toLowerCase();
      metas = MOVIES.filter((m) => m.name.toLowerCase().includes(query));
    }
    return json(res, 200, { metas });
  }

  if (segments[0] === "meta" && segments[1] === "movie") {
    const id = decodeURIComponent(segments[2]?.replace(/\.json$/, "") ?? "");
    const movie = MOVIES.find((m) => m.id === id);
    if (!movie) return notFound(res);
    return json(res, 200, { meta: { ...movie, background: undefined, runtime: "4 sec", videos: [] } });
  }

  if (segments[0] === "stream" && segments[1] === "movie") {
    const id = decodeURIComponent(segments[2]?.replace(/\.json$/, "") ?? "");
    if (!MOVIES.some((m) => m.id === id)) return notFound(res);
    return json(res, 200, {
      streams: [{ url: `http://localhost:${PORT}/sample.webm`, name: "Mock Dev Add-on", title: "Local sample clip (WebM, 4s)" }],
    });
  }

  if (segments[0] === "subtitles" && segments[1] === "movie") {
    return json(res, 200, { subtitles: [] });
  }

  if (segments[0] === "sample.webm") {
    if (!fs.existsSync(SAMPLE_VIDEO_PATH)) return notFound(res);
    return serveVideoWithRangeSupport(req, res, SAMPLE_VIDEO_PATH);
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`Mock add-on running at http://localhost:${PORT}/manifest.json`);
});
