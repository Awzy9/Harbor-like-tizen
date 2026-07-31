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

## Current status: Milestones 1-5 done, into 6

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
  streams across add-ons per title/episode, `StreamNormalizer` drops
  non-http(s) streams (no torrent engine/YouTube embedding by design),
  `StreamRanker` scores by parsed quality/HDR text heuristics. Stream
  Selection and Player screens wire this into actual playback.
- **Account service seam** (`src/stremio/account/`) — the
  `StremioAccountService` interface is defined but deliberately
  **unimplemented** (`UnimplementedAccountService` rejects every call). The
  public Stremio protocol doesn't cover account authentication, so a real
  implementation needs its own research pass against Stremio Web's current
  login/sync flow before it's built — see `docs/PROJECT_PLAN.md` sections 13
  and 59 (Risk 1).
- **Video player** (`src/player/TizenVideoPlayer.ts`) — a `<video>` wrapper
  (load/play/pause/seek/setVolume/setSubtitle/setAudio/stop/destroy) plus a
  lightweight `PlaybackCompatibility` pre-flight check. No HLS.js/DASH.js yet
  on purpose — Tizen's native HLS support is the first thing to prove out
  before reaching for a heavier library. **Resume** (`src/storage/playbackProgress.ts`)
  saves position every ~7s plus on pause/unmount and seeks back on reopening
  the same title.
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
  clip plus an external HLS test stream) validate the remote-nav and
  playback pipelines in isolation.

What's explicitly **not** built yet (see `docs/PROJECT_PLAN.md` for the full
roadmap): account linking/QR flow and add-on sync, cross-add-on
metadata/catalog merging (currently first-success-wins / one row per
add-on+catalog, not deduplicated across add-ons), ASS/SSA subtitle
conversion, offline mode, and TV packaging/signing.

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

Not yet automated in this repo — `npm run package` is a placeholder for a
future signing/`.wgt`-packaging script. For now, follow
`docs/PROJECT_PLAN.md` sections 4-7 and 53: install Tizen Studio or the VS
Code Tizen extension, generate a certificate profile via the Samsung
Certificate Manager (**back it up** — losing it complicates future updates),
enable Developer Mode on the TV (Smart Hub → Apps → App Settings → `12345` →
Developer Mode ON), add the TV to the Tizen Device Manager on port 26101,
then build/sign/install the `dist/` output as a `.wgt` from Tizen Studio.

`config.xml`'s `tizen:application id`/`package` are placeholders
(`HbrTzn00001`) — regenerate them to match your own certificate before
packaging a real build.

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
