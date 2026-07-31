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

## Current status: Milestone 1 (+ early Milestone 2 groundwork)

What's implemented:

- **App shell** — a Vite + React + TypeScript Tizen web app that boots into a
  4-item nav bar (Home / Test Remote / Test Player / Settings).
- **TV remote navigation** (`src/tizen/remote.ts`, `src/navigation/`) — a
  spatial-navigation focus system driven by DOM rects, so any grid/row layout
  is navigable with just Up/Down/Left/Right/Enter/Back, with a visible focus
  ring (`src/components/FocusableItem.tsx`). Works identically with arrow
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
  persists the installed-add-on list to local storage. No add-ons are
  hard-coded anywhere.
- **Account service seam** (`src/stremio/account/`) — the
  `StremioAccountService` interface is defined but deliberately
  **unimplemented** (`UnimplementedAccountService` rejects every call). The
  public Stremio protocol doesn't cover account authentication, so a real
  implementation needs its own research pass against Stremio Web's current
  login/sync flow before it's built — see `docs/PROJECT_PLAN.md` sections 13
  and 59 (Risk 1).
- **Baseline video player** (`src/player/TizenVideoPlayer.ts`) — a thin
  `<video>` wrapper (load/play/pause/seek/setVolume/setSubtitle/setAudio/
  stop/destroy) plus a lightweight `PlaybackCompatibility` pre-flight check.
  No HLS.js/DASH.js yet on purpose — Tizen's native HLS support is the first
  thing to prove out before reaching for a heavier library.
- **Test screens** — a Test Remote screen (live key-event log + a focusable
  grid) and a Test Player screen (loads public test MP4/HLS streams) exist
  specifically to validate the remote-nav and playback pipelines in
  isolation, per the plan's "prove the pipes work before building the real
  UI" approach.

What's explicitly **not** built yet (see `docs/PROJECT_PLAN.md` for the full
roadmap): real catalog/metadata aggregation across add-ons, search, account
linking/QR flow, stream ranking, subtitle format conversion, resume/continue
watching persistence, series/episode navigation, and everything after
Milestone 2.

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
```

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
src/
|-- app/          # App shell, top-level nav bar, screen switcher
|-- components/   # Shared UI (FocusableItem, etc.)
|-- navigation/   # Spatial-navigation focus system
|-- player/       # TizenVideoPlayer, PlaybackCompatibility
|-- screens/      # Home, Settings, TestPlayer, TestRemote
|-- state/        # Zustand stores
|-- storage/      # Typed localStorage wrapper
|-- stremio/
|   |-- addon-client/  # Manifest/catalog/meta/stream/subtitle protocol client
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
