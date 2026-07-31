# Harbor-like Tizen

An independent Stremio-compatible client for Samsung Smart TVs.

This is **not** an official Stremio product and is not affiliated with or
endorsed by Stremio or Harbor (the desktop Stremio client this project takes
UI/architecture inspiration from). It never hosts, indexes, or bundles media
or content sources — it is only a client for the open Stremio add-on
protocol; all content comes from add-ons the user installs themselves.

The full project plan (architecture rationale, milestones, testing matrix,
distribution process, etc.) lives in [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md).
This README only covers what exists right now and how to run it.

## Current status: Milestones 1-6 done, into 7

What's implemented:

- **App shell** — a Vite + React + TypeScript Tizen web app with a top-level
  nav bar (Home / Search / Add-ons / Settings); Test Remote and Test Player
  moved under Settings → Developer Tools.
- **TV remote navigation** (`src/tizen/remote.ts`, `src/navigation/`) — a
  spatial-navigation focus system driven by DOM rects, so any grid/row layout
  is navigable with just Up/Down/Left/Right/Enter/Back, with a visible focus
  ring (`src/components/FocusableItem.tsx`). A focused `<input>` (the add-on
  URL field, search box) gets real native text editing — spatial nav steps
  aside for it — with Back exiting the field. Works identically with arrow
  keys in a desktop browser and with an actual Samsung remote.
  Performance-tuned for TV hardware: focus state lives in a manual external
  store (`useSyncExternalStore`), so a keypress only re-renders the exactly
  two elements whose focus state actually changed — not every focusable item
  on screen (verified: 2 renders per move regardless of catalog size, not
  O(n)). The focused element auto-scrolls into view, and losing focus (e.g.
  navigating away from a button mid-screen) recovers immediately rather than
  leaving the next keypress to "wake up" focus first. The same scrutiny
  applies to `TizenVideoPlayer`/`PlayerScreen`: status changes
  (loading/playing/paused/ended/error) and per-tick time updates are
  separate subscriptions (`onStatusChange` vs. `onTimeUpdate`), so the
  progress bar/clock update via direct DOM writes on every `timeupdate`
  (several times a second) without going through React state at all —
  verified at 0 control re-renders during 1.5s of continuous playback, vs.
  exactly 2 for an actual navigation move, regardless of how fast the video
  is ticking underneath it. Back navigation
  (`src/state/navigationStore.ts`) is a real history stack, not a
  jump-to-Home shortcut: drilling in through Details → Stream Selection →
  Player steps back one screen at a time on Back, matching
  docs/PROJECT_PLAN.md section 16's expected chain; switching between
  top-level tabs (Home/Search/Add-ons/Settings) stays peer navigation
  (no stacking) since those aren't a drill-in chain.
- **Tizen environment layer** (`src/tizen/`) — feature-detected wrappers
  around `window.tizen` (`tvinputdevice`, `application`, `systeminfo`) that
  no-op safely outside a real Tizen runtime, so the whole app runs and is
  testable in a normal browser during development.
- **Stremio add-on client** (`src/stremio/addon-client/`) — `AddonClient`
  implements `loadManifest` / `getCatalog` / `getMeta` / `getStreams` /
  `getSubtitles` against the public add-on protocol, with request timeouts,
  response-size caps, JSON/shape validation, and manifest-declared-resource
  checks, since add-ons are untrusted third-party services. `AddonManager`
  persists the installed-add-on list to local storage. **Add-ons screen**
  lets you install/enable/disable/remove add-ons by manifest URL — no add-on
  is ever hard-coded.
- **Catalog aggregation** (`src/stremio/catalog/CatalogAggregator.ts`) — Home
  renders one row per installed add-on × declared catalog, fetched in
  parallel with per-row failure isolation (a broken add-on shows as one
  failed row, not a broken Home screen).
- **Metadata aggregation** (`src/stremio/metadata/MetadataAggregator.ts`) +
  **Details screen** — fetches meta preferring the add-on a catalog tile came
  from, falling back to any other add-on that declares meta support for the
  type.
- **Search** (`src/stremio/catalog/SearchService.ts` + Search screen) —
  queries every catalog that declares a `search` extra, deduplicated across
  add-ons.
- **Stream resolution** (`src/stremio/streams/`) — `StreamResolver` collects
  streams across add-ons per title/episode. `StreamNormalizer` keeps both
  direct http(s) streams and torrent/infoHash streams (tagged
  `protocol: "http" | "torrent"`); YouTube-ID-only streams are still dropped
  (no YouTube embedding by design). `StreamRanker` scores by parsed
  quality/HDR text heuristics, ranking torrent streams below an equivalent
  direct URL since torrents need peer discovery before anything plays. Stream
  Selection (which shows a "Torrent" badge) and Player screens wire this into
  actual playback.
- **Stremio account login + add-on sync** (`src/stremio/account/`) — email/password
  login and one-way add-on pull/push against `api.strem.io`, implemented
  against the contract confirmed by reading Stremio's own officially-maintained
  `stremio-api-client` source (`StremioApiClient.ts` documents exactly what
  was confirmed vs. not). The TV-friendly QR/short-code pairing flow
  (`link.stremio.com`) is deliberately **not** implemented — its backend
  contract couldn't be verified from public sources, so email/password via
  the on-screen text field is the login path for now. `getLibrary()` is
  likewise left unimplemented: Stremio's library-sync API is a separate,
  more complex delta-sync endpoint outside this research pass. Reachable via
  Settings → Account. See `docs/PROJECT_PLAN.md` sections 13 and 59 (Risk 1)
  for the full reasoning.
- **Video player** (`src/player/TizenVideoPlayer.ts`) — a `<video>` wrapper
  (load/play/pause/seek/setVolume/setSubtitle/setAudio/stop/destroy) plus a
  lightweight `PlaybackCompatibility` pre-flight check. Native `<video>` is
  always tried first for HLS (Tizen's WebKit has native HLS on most TV
  generations); **hls.js** and **dash.js** are loaded via dynamic `import()`
  as MSE-based fallbacks for everything else (virtually all DASH, and any HLS
  the platform can't play natively) — dynamic import keeps both libraries out
  of the main bundle entirely until a stream actually needs one, so
  Home/Search/Settings never pay for code they don't use. **Torrent/infoHash
  streams** play via `loadTorrent()` → `src/player/TorrentStreamManager.ts`
  (WebTorrent), which builds a magnet URI from the stream's `infoHash` +
  `sources` and renders the largest video file straight into the same
  `<video>` element. This is a genuinely best-effort path, not a full
  BitTorrent client: WebTorrent's browser build ships with DHT compiled out
  entirely (`bittorrent-dht: false` in its own `package.json`), so peer
  discovery depends solely on WSS (WebSocket Secure) trackers and WebSeeds —
  the plain UDP/HTTP tracker hints most add-ons list are silently unusable
  in-browser. A 25s peer-discovery timeout guarantees the UI surfaces a real
  error instead of spinning forever when no WSS peers are reachable.
  Shipping WebTorrent through Vite's Rollup-based build also required
  several small workarounds in `vite.config.ts` and `scripts/shims/` for
  places where WebTorrent's dependency tree relies on webpack/browserify
  browser-field conventions that Vite doesn't apply the same way — each is
  commented in place with why it's safe. **Resume** (`src/storage/playbackProgress.ts`)
  saves position (plus denormalized addon/type/title/poster context) every
  ~7s and on pause/unmount, and seeks back on reopening the same title.
  "Finished" is a percentage of duration (90%+), not a fixed few seconds —
  a flat cutoff is irrelevant for a 2-hour movie but too tight for a short
  clip. A **Continue Watching** row on Home surfaces every in-progress
  (non-finished) title whose add-on is still installed and enabled, sorted
  by recency, linking straight to Stream Selection for that content id. The
  **seek interval** (Settings → Seek Interval, cycles 5/10/15/30s) is a
  persisted preference (`src/storage/playbackSettings.ts`) instead of a
  fixed constant. On an OLED panel, a bright static control bar burned in
  during long playback is a real concern (spec sections 17/37) — the
  player's control overlay auto-hides after 5s of no remote input while
  actually playing (not while paused or a panel is open) and reappears
  instantly on any keypress.
- **Library** (`src/storage/library.ts`, Library tab) — favorite and
  watched are independent flags per title (denormalized title/poster, same
  pattern as PlaybackProgress), toggled from Details ("☆ Add to
  Favorites"/"Mark Watched"). The Library screen filters by All/Favorites/
  Watched and shows a Watched/Favorite badge per poster. Un-favoriting an
  unwatched title (or un-marking a non-favorited watched one) deletes the
  entry entirely rather than leaving a dead `{favorited: false, watched:
  false}` row around.
- **Device capabilities & Diagnostics** (`src/tizen/deviceCapabilities.ts`,
  Settings → Developer Tools → Diagnostics) — real, feature-detected (never
  hardcoded) codec/HLS/DASH/HDR/network capabilities via `canPlayType()`/
  `matchMedia()`/the Network Information API, used to rank streams (below)
  and shown on a diagnostics page with Test Network/Video/HLS/DASH/Subtitles
  buttons that exercise the real playback/network paths, plus a
  centralized logger (`src/services/logger.ts`) feeding its log view.
- **Automatic playback fallback** (`src/player/PlaybackFallbackManager.ts`) —
  Stream Selection hands the Player screen the *whole* ranked stream list
  (chosen stream first), and if one fails before it starts playing, the
  manager automatically tries the next-ranked stream — up to 3 total
  attempts — showing "Trying another source…" and, if every attempt fails,
  an "Unable to find a playable source" screen with Try Another Stream/
  Return actions, instead of leaving the user stuck on a dead player.
  Playback errors are classified into a structured taxonomy
  (`src/types/playbackError.ts`: NETWORK_ERROR, UNSUPPORTED_CODEC,
  MANIFEST_ERROR, TORRENT_ERROR, etc.) so both the fallback manager and the
  UI get an actual reason, not a generic "Playback error." `StreamRanker`
  factors in device codec/HDR support (parsed the same best-effort way as
  quality) so a stream the TV can't decode ranks below one it can, and
  Stream Selection shows a RECOMMENDED badge plus quality/codec/HDR/
  Direct-or-Torrent badges instead of a single quality string.
- **Subtitles** (`src/stremio/subtitles/`, `src/player/SubtitleManager.ts`) —
  aggregates subtitles across every add-on declaring subtitle support for the
  type plus any embedded directly in the resolved stream; converts SRT to
  WebVTT (the only format `<track>` renders natively) and falls back to a
  visible failure rather than mistranslating anything fancier (ASS/SSA).
  Selectable from the Player screen's Subtitles panel.
- **Audio tracks** (`src/player/AudioManager.ts`) — wraps
  `HTMLMediaElement.audioTracks`; the Player screen's Audio button only
  appears when the platform actually reports more than one track — never a
  fabricated list.
- **Next episode** — Details screen computes the next episode from the
  sorted episode list and threads it through Stream Selection into the
  Player; on playback end, an "Up Next" panel counts down and auto-advances
  (or Play Now / Cancel).
- **Local mock add-on** (`scripts/mock-addon-server.mjs`, run via
  `npm run mock-addon`) — a small self-contained Stremio-protocol server used
  only for development, so the full install → catalog → details → stream
  select → play → next-episode pipeline can be exercised end-to-end without
  any real, legally-questionable content source. Serves a 2-movie catalog, a
  2-episode mock series, and one subtitle fixture; supports HTTP Range
  requests (needed for `<video>` seeking).
- **Test screens** (now under Settings → Developer Tools) — Test Remote (live
  key-event log + a focusable grid) and Test Player (loads a bundled local
  clip, external HLS/DASH test streams, and a public-domain torrent —
  WebTorrent's own long-standing Sintel demo, with WSS trackers attached)
  validate the remote-nav and playback pipelines in isolation.
- **Crash/offline resilience** — a root `ErrorBoundary` (`src/app/ErrorBoundary.tsx`)
  catches render errors app-wide, plus a per-screen boundary keyed by screen
  identity so a crash on one screen (e.g. an add-on returning malformed
  metadata) is recoverable by navigating away instead of taking down the
  whole app; its fallback UI deliberately avoids the app's own focus system
  so a crash inside navigation itself can't also break the recovery path.
  `useOnlineStatus` + an offline banner (`src/hooks/useOnlineStatus.ts`)
  reflect real network state. Home caches its last successful catalog fetch
  (`src/storage/homeCatalogCache.ts`) and falls back to it — labeled and with
  a Refresh action — when a fresh fetch fails or the network is down, rather
  than replacing good data with a wall of per-row errors; with no cache and
  no network it shows a plain "nothing cached yet" state with Retry.

What's explicitly **not** built yet (see `docs/PROJECT_PLAN.md` for the full
roadmap): the QR/short-code TV account-linking flow and library sync,
cross-add-on metadata/catalog merging (currently first-success-wins / one row
per add-on+catalog, not deduplicated across add-ons), ASS/SSA subtitle
conversion, image/list virtualization for large catalogs, and TV
packaging/signing.

**Playback verification limits (development sandbox):** this project was
developed in a sandboxed environment whose outbound network policy blocks
every public HLS/DASH test CDN tried (including Apple's, Akamai's, and
Mux's) and every WSS BitTorrent tracker, at the TLS layer. That means HLS,
DASH, and torrent playback here have only been verified up to the point
network access is required — code paths, error handling, and the "no
infinite spinner" guarantee (a 25s peer-discovery timeout for torrents) are
confirmed correct, but actual segment-level HLS/DASH decoding and torrent
peer connections are not verified end-to-end in this environment. This is
stated rather than glossed over; treat those three paths as needing a real
network (or a real Tizen TV) before being called production-ready.
Separately, WebTorrent's dependency tree (`bittorrent-tracker` →
`torrent-discovery` → the `ip` package) carries a known high-severity SSRF
advisory in `ip`'s `isPublic()` check (`npm audit`); the advisory's primary
concern is server-side SSRF, which doesn't directly apply to a
browser-bundled client, but it's disclosed here rather than silently
accepted — re-run `npm audit` before shipping to see current status.

## Requirements

- Node.js 20+ and npm
- A Chromium-based browser for day-to-day development (no Tizen hardware
  needed to iterate on UI/navigation/add-on-client logic)
- Samsung Tizen Studio or the VS Code Tizen extension + Samsung Certificate
  Manager, **only** once you're ready to package/sign/install on a real TV
  or the Tizen Simulator (not needed for browser development)

## Local development

```bash
npm install
npm run dev
```

Open the printed local URL in a browser. Arrow keys move focus, Enter
activates, Escape/Backspace act as "Back". `window.tizen` is undefined in a
browser, so everything under `src/tizen/` transparently falls back to
browser-safe behavior (see `src/tizen/env.ts`).

```bash
npm run build      # type-checks then produces dist/ via Vite
npm run typecheck  # tsc --noEmit only
npm run mock-addon # runs a local test add-on at http://localhost:7777/manifest.json
```

To try the full pipeline without any real add-on: run `npm run mock-addon` in
one terminal, `npm run dev` in another, then in the app go to **Add-ons** and
install `http://localhost:7777/manifest.json`. Its catalog, details, and
stream all point back to the bundled local sample clip.

## Packaging for a real Samsung TV

`npm run package` builds the app and stages `dist/` as a valid Tizen widget
project (copies `config.xml` next to `index.html` — Vite only copies
`public/`, and `config.xml` isn't a browser asset, so without this step
`dist/` is missing the one file Tizen packaging actually requires). Signing
and installing still needs your own Samsung certificate and either Tizen
Studio or the `tizen`/`sdb` CLI — neither belongs in this repo or should be
automated with someone else's private certificate.

1. **Install the tooling.** Tizen Studio (Samsung's official IDE, bundles
   the Certificate Manager, Device Manager, emulator, and CLI) is the most
   reliable path: install it, then in its Package Manager install the **TV
   Extension** and **Samsung Certificate Extension**. The VS Code Tizen
   extension is a lighter alternative for day-to-day editing, but still
   relies on the same underlying SDK/CLI, so Tizen Studio (or at least its
   command-line tools) ends up installed either way.
2. **Create a certificate profile.** Tizen Studio → Certificate Manager →
   create a new profile, signing in with a Samsung Account when prompted.
   This generates an author certificate plus a Samsung/Tizen distributor
   certificate. **Back this up somewhere safe** — losing it means you can't
   sign updates compatible with whatever's already installed on the TV.
3. **Regenerate `config.xml`'s app identity to match your certificate.**
   `tizen:application id="HbrTzn00001.HarborLikeTizen"` and
   `package="HbrTzn00001"` in `config.xml` are placeholders. Tizen Studio's
   "New Tizen Project" flow (or the Certificate Manager) will show/generate
   the correct 10-character package prefix tied to your certificate —
   update both attributes in `config.xml` to match before packaging.
4. **Enable Developer Mode on the TV.** Smart Hub → Apps → (on the Apps
   screen) open the app settings/menu → enter `12345` → toggle Developer IP
   / Developer Mode ON → enter your computer's IP address when prompted →
   the TV reboots. Confirm the TV's own IP under Settings → General →
   Network → Network Status — you'll need it in the next step. (Exact menu
   wording has shifted across Tizen OS versions; if `12345` doesn't surface
   it, search "\[your TV year] Tizen developer mode" — the mechanism is the
   same, only the exact taps differ.)
5. **Connect the TV.** Same network as your dev machine (some routers'
   guest/isolated Wi-Fi networks block this — use the main network if the
   TV won't connect). In Tizen Studio's Device Manager, add the TV by its
   IP; it connects on port 26101 and should show as connected.
6. **Build and package:**
   ```bash
   npm run package   # builds, then stages dist/ with config.xml
   ```
   Then either import `dist/` into Tizen Studio as an existing Tizen Web
   Project (File → New → Tizen Project From Existing Sources, Web
   Application template, TV profile) and use its Build/Run buttons — this
   is the most forgiving path since it handles signing and install through
   the GUI — or use the CLI directly (flags vary by Tizen Studio version,
   check `tizen package --help`):
   ```bash
   tizen package -t wgt -s <your-certificate-profile-name> -- dist
   tizen install -n <output>.wgt -t <device-id>   # device-id from `sdb devices`
   ```
7. **Launch it** from the TV's Apps screen, or directly from Tizen Studio's
   Run button. First-run failures are almost always one of: certificate
   profile doesn't match `config.xml`'s package id, TV and computer aren't
   actually on the same network segment, or Developer Mode's registered IP
   is stale (re-enter it if you changed networks).
8. **Debug** via Tizen Studio's Web Inspector (or plain Chrome DevTools —
   the Tizen WebKit runtime exposes a remote debugging endpoint once the app
   is running) for console/network errors, and `sdb dlog` for lower-level
   Tizen platform logs.

USB installation is not supported by Samsung for security reasons — it's
network-only, hence the IP/Developer Mode dance above.

## Project structure

```
scripts/
`-- mock-addon-server.mjs  # local dev-only Stremio-protocol test add-on

src/
|-- app/          # App shell, top-level nav bar, screen switcher
|-- components/   # Shared UI (FocusableItem, FocusableTextField, PosterTile)
|-- navigation/   # Spatial-navigation focus system
|-- player/       # TizenVideoPlayer, PlaybackCompatibility
|-- screens/      # Home, Search, Addons, Details, StreamSelection, Player, Settings, TestPlayer, TestRemote
|-- state/        # Zustand stores (navigation)
|-- storage/      # Typed localStorage wrapper, playback progress
|-- stremio/
|   |-- addon-client/  # Manifest/catalog/meta/stream/subtitle protocol client + AddonManager
|   |-- catalog/       # CatalogAggregator, SearchService
|   |-- metadata/      # MetadataAggregator
|   |-- streams/       # StreamResolver, StreamNormalizer, StreamRanker
|   `-- account/       # StremioAccountService interface (unimplemented)
|-- tizen/        # window.tizen wrappers: remote, lifecycle, device
`-- types/        # Shared domain types
```

## Licensing and content policy

MIT-licensed (see `LICENSE`). This project ships with zero bundled content
sources — users add their own Stremio-compatible add-ons. Before any public
release, build the license inventory described in `docs/PROJECT_PLAN.md`
section 48 (every dependency's license, plus any UI/design inspiration taken
from Harbor or Stremio Web's open-source code) and write the privacy policy
described in section 32.
