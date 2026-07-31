# Project Plan: Harbor-Style Stremio Client for Samsung Tizen TV

This is the full project plan the app is being built against, kept verbatim
for reference as later milestones are implemented. See the root `README.md`
for current implementation status.

## 1. Project Goal

Build an independent Samsung Smart TV application that provides a Harbor-like experience on Samsung OLED/Smart TVs.

The application should:

* Run directly on Samsung Tizen TV.
* Have a TV-optimized interface controlled primarily with the Samsung remote.
* Connect to a user's Stremio account.
* Synchronize the user's installed Stremio add-ons where the required Stremio account/client functionality is supported.
* Use the Stremio add-on protocol to retrieve catalogs, metadata, streams, and subtitles.
* Display the user's library and catalogs.
* Search across installed add-ons.
* Present available streams and allow the user to select one.
* Play compatible streams using Samsung's TV playback capabilities.
* Remember playback position locally and synchronize account/library information where supported.
* Provide subtitle and audio-track controls where supported by the stream and Samsung TV.
* Never host or distribute media itself.
* Never bundle third-party content sources by default.
* Keep the project modular so additional Stremio functionality can be added later.

Harbor itself describes its role as a client for the open Stremio add-on protocol rather than a media/content provider. The Stremio protocol defines standardized catalog, metadata, stream, and subtitle resources.

## 2. Important Architecture Decision

Do NOT try to port the complete Harbor desktop application unchanged.

Harbor currently uses React, Vite, Tailwind CSS, Tauri, Rust, a Rust/WASM stream core, and libmpv for playback.

Samsung Tizen TV should instead use: HTML, CSS, JavaScript, React, Vite, Samsung Tizen Web APIs, Samsung TV multimedia capabilities, and the Stremio Add-on Protocol.

```
                  SAMSUNG TIZEN TV
                         |
                +--------+--------+
                |                 |
            React UI          TV Services
                |                 |
                |            Remote Control
                |            Video Playback
                |            Local Storage
                |                 |
                +--------+--------+
                         |
                  Stremio Client Core
                         |
        +----------------+----------------+
        |                |                |
      Account          Add-ons          Library
        |                |                |
        |        +-------+--------+       |
        |        |       |        |       |
        |     Catalog   Meta    Streams    |
        |                         |        |
        +-------------------------+--------+
                                  |
                         Samsung TV Player
```

## 3. Technology Stack

Frontend: React, TypeScript, Vite, CSS/Tailwind where appropriate, React Router only where useful, Zustand (lightweight state), standard Web APIs, Samsung Tizen APIs where necessary.

Avoid unnecessary npm packages — TV environments are more constrained than desktop browsers.

```
src/
|-- app/
|-- components/
|-- screens/
|-- navigation/
|-- player/
|-- stremio/
|   |-- addon-client/
|   |-- catalog/
|   |-- metadata/
|   |-- streams/
|   |-- subtitles/
|   `-- account/
|-- storage/
|-- tizen/
|-- hooks/
|-- types/
|-- utils/
`-- main.tsx
```

## 4. Samsung Development Environment

Recommended: VS Code + Tizen TV extension + Samsung TV SDK + Git + Node.js + pnpm/npm.

Alternative: Tizen Studio + Samsung TV extensions + Certificate Extension + TV Simulator/Emulator + Web Inspector.

## 5. Verify the Samsung TV Model First

Record before development: TV model, TV year, Tizen version, firmware, screen resolution, OLED model. Target a realistic minimum Tizen version rather than assuming uniform behavior. Initial primary target: Samsung OLED 2023+, then test older models later.

## 6. Create the Tizen TV Project

```
harbor-tizen/
|-- config.xml
|-- package.json
|-- index.html
|-- src/
|-- public/
|-- assets/
|-- vite.config.ts
`-- README.md
```

The final package is a signed `.wgt`. Back up the certificate profile carefully.

## 7. Enable Developer Mode on the Samsung TV

Smart Hub -> Apps -> App Settings -> enter 12345 -> Developer Mode ON -> enter computer IP -> reboot TV. TV and computer must be on the same network. Add the TV to Samsung's Device Manager (dev connection on port 26101).

## 8. First Milestone: Get a Blank App Running

Screens: Home, Settings, Test Player, Test Remote Navigation.

Success criterion: Computer -> Build -> Signed .wgt -> Samsung TV -> App launches, before implementing any complicated networking.

## 9. Design the TV UI First

Design for a 10-foot viewing distance, not a phone interface scaled up.

Navigation: HOME, DISCOVER, SEARCH, LIBRARY, ADD-ONS, SETTINGS.

Home: Continue Watching, Recommended, Trending, Recently Added, Movies, Series, Your Add-ons.

Details page: Poster, Background, Title, Year, Genre, Description, Seasons, Episodes, Watch, Trailer, Add to Library.

Stream selection: Available Streams, quality/provider/language/size, PLAY.

Player: video, title, progress, play/pause, subtitles, audio, quality, seek, episodes.

## 10. Remote-Control Navigation

Arrow, Enter, and Back are automatically detected; other keys (MediaPlayPause, MediaRewind, MediaFastForward, etc.) must be registered via the TV input API.

Implement a universal focus system for every interactive component: focused, selected, disabled, loading. The focus indicator must be highly visible — never make the user guess what has focus.

## 11. Build the Stremio Add-on Client

Protocol resources: manifest, catalog, meta, stream, subtitles.

```
/manifest.json
/catalog/{type}/{id}.json
/meta/{type}/{id}.json
/stream/{type}/{id}.json
/subtitles/{type}/{id}.json
```

`src/stremio/addon-client/`: AddonClient, AddonManifest, AddonCatalog, AddonMetadata, AddonStream, AddonSubtitle.

```ts
interface AddonClient {
  loadManifest(url: string): Promise<AddonManifest>;
  getCatalog(addon: AddonManifest, type: string, catalogId: string): Promise<MetaPreview[]>;
  getMeta(addon: AddonManifest, type: string, id: string): Promise<Meta>;
  getStreams(addon: AddonManifest, type: string, id: string): Promise<Stream[]>;
  getSubtitles(addon: AddonManifest, type: string, id: string): Promise<Subtitle[]>;
}
```

## 12. Add-on Manager

Responsibilities: install, remove, enable/disable, load, validate manifest, cache manifest, update manifest, store configuration, order add-ons.

```ts
interface InstalledAddon {
  transportUrl: string;
  manifest: AddonManifest;
  enabled: boolean;
  installedAt: number;
  order: number;
}
```

Do not hard-code individual community add-ons — the application works from add-on manifests only.

## 13. Account Synchronization

Goal: user's existing Stremio account -> Samsung app -> same/additional installed add-ons, same library, same account state where supported.

**Important**: the public Stremio add-on protocol is not an account-authentication API — it defines the add-on interface, not the account backend. Do not assume any private endpoint will remain stable forever.

Correct approach: study the current open-source Stremio web/client implementation and login flow, reuse documented/public mechanisms wherever possible, avoid blindly copying undocumented authentication mechanisms, and keep the integration isolated behind `StremioAccountService` so it can change later.

```ts
interface StremioAccountService {
  login(): Promise<AuthSession>;
  logout(): Promise<void>;
  getInstalledAddons(): Promise<InstalledAddon[]>;
  getLibrary(): Promise<LibraryItem[]>;
  syncAddons(): Promise<void>;
  getUserProfile(): Promise<UserProfile>;
}
```

## 14. TV Login

Do not force a long email/password entry via remote. Use a TV-friendly account-linking flow (QR code + short code, "waiting for authorization").

## 15. Local Storage

Cache: settings, installedAddonCache, addonManifests, recentSearches, continueWatching, lastSelectedProfile, UI preferences, cached metadata.

Never store plaintext passwords, long-lived secrets unnecessarily, or third-party API keys unsafely. Use expiration and cache invalidation.

## 16. Catalog Aggregation

Combine catalogs from multiple add-ons into unified home rows. Implement `CatalogAggregator`: parallel requests, timeouts, retry logic, caching, deduplication, sorting, failure isolation. One broken add-on must not break the whole Home screen.

## 17. Metadata Aggregation

Merge meta requests from multiple add-ons per title into one normalized details page (id, type, name, poster, background, description, releaseInfo, genres, runtime, cast, director, videos, links). Avoid duplicates.

## 18. Search

TV-remote-friendly on-screen keyboard plus physical keyboard support. `SearchService` sends searches to add-ons supporting catalog search (the Stremio SDK documents catalog requests as used for both browsing and search).

## 19. Stream Resolution

Pipeline: title metadata -> request streams from all add-ons -> collect -> normalize -> filter -> rank -> display.

`StreamResolver`, `StreamNormalizer`, `StreamRanker`.

```ts
interface ResolvedStream {
  url?: string;
  type?: string;
  name?: string;
  title?: string;
  quality?: string;
  behaviorHints?: object;
  subtitles?: Subtitle[];
  addonId: string;
}
```

Do not assume every stream is a plain MP4 URL — MP4/HLS/DASH/WebM/other are all possible. The player should explicitly determine Samsung support.

## 20. The Most Important Technical Challenge: Playback

Harbor desktop's libmpv is not portable to Tizen. Use HTML5 `<video>` first — Samsung officially supports it.

`TizenVideoPlayer`: load(url), play(), pause(), seek(seconds), setVolume(value), setSubtitle(track), setAudio(track), stop(), destroy().

## 21. Playback Compatibility Layer

Don't just assign `video.src` and hope. `PlaybackCompatibility` analyzes URL/MIME/container/codec/resolution/HDR/HLS/DASH/subtitles/audio/DRM and decides SUPPORTED / UNSUPPORTED / NEEDS_SPECIAL_HANDLING / UNKNOWN. Support differs by TV model/year.

## 22. HLS/DASH

Test HLS first (native support on most Tizen versions). Don't add a heavyweight playback library until a real compatibility problem is identified.

**Update:** DASH has essentially no native browser/TV support (unlike HLS), so it's the "real compatibility problem" this guidance anticipated — `TizenVideoPlayer` tries native `<video>` first for HLS and always routes DASH through dash.js. Both hls.js and dash.js are loaded via dynamic `import()`, not a static top-level import: statically importing dash.js alone pushed the main bundle from ~190KB to ~1.6MB, which every screen would have paid for regardless of whether it ever touches video. See `src/player/TizenVideoPlayer.ts`.

## 23. Subtitles

Add-ons can expose subtitle resources; Samsung's HTML5 video supports WebVTT via `<track>`. Convert other formats (SRT/ASS/SSA) where legally and technically appropriate — don't assume native support for everything.

## 24. Audio Tracks

Expose only tracks the stream/browser/player actually make available — never fabricate a list.

## 25. Playback Controls

Play/pause, seek, progress bar, volume, mute, subtitles, audio, fullscreen, episode next/previous, speed (where supported), resume, restart. Standard remote mappings for Enter/Left/Right/Up/Down/Back/MediaRewind/MediaFastForward.

## 26. Resume / Continue Watching

```ts
interface PlaybackProgress {
  contentId: string;
  episodeId?: string;
  position: number;
  duration: number;
  updatedAt: number;
}
```

Save every 5-10 seconds, plus on pause/stop/ended — not on every single video event.

## 27. Automatic Episode Selection

Series -> season -> episode -> stream. After completion, show next episode if available. Auto-play/countdown/skip-intro are later, separate features.

## 28. Stream Ranking

Independent, configurable scoring (source availability, direct playable URL, preferred language, resolution/HDR, bitrate, known-compatible codec, subtitle availability). Largest file size is not automatically "best."

## 29. Add-on Configuration

Some add-ons need per-user configuration baked into their transport URL — never assume every add-on is a bare `https://domain.com/manifest.json`. Preserve the actual configured URL.

## 30. Add-on Error Handling

One add-on failing (timeout/invalid response) must not take down Home. Timeout 5-10s, limited retries, per-request abort, safe logging.

## 31. Security Model

Treat add-ons as untrusted network services: prefer HTTPS, timeout requests, cap response size, validate JSON/URLs, handle redirects, sanitize rendering, never `eval()` or execute add-on-supplied script, never inject unsanitized HTML from metadata.

## 32. Privacy

No analytics, no advertising SDK, no unnecessary tracking as the initial default. Publish a privacy policy covering account info accessed, local storage, network requests, and what add-ons can see.

## 33. Do Not Bundle Questionable Content Sources

Ship with no third-party piracy sources, no copyrighted media, no illegal streaming endpoints. Users bring their own add-ons.

## 34. Suggested Application Screens

Splash, Link Account, Home, Discover, Search, Search Results, Movie Details, Series Details, Season/Episode Selector, Stream Selection, Video Player, Library, Add-ons, Add-on Details, Add-on Configuration, Settings, Playback Settings, Subtitle Settings, About, Error/Offline.

## 35. Home Screen Data Flow

Load local cache -> check account -> load add-on list -> load manifests -> determine catalogs -> request rows in parallel -> merge -> deduplicate -> render. Each rail loads independently; never block all of Home on one add-on.

## 36. Offline Mode

The app must still open with no network: show an offline state plus cached library, with retry. A network failure must never crash the app.

## 37. Performance Requirements

Target: Home load under 3-5s with cache, no blocking large JSON operations, lazy-loaded images, virtualized long lists, cached metadata, cancelled unused requests, small DOM, minimal animation.

## 38. Image Optimization

Use correctly sized thumbnail/poster/background images, cache frequently used images, use placeholders — never download giant originals for a TV-sized tile.

## 39. TV Animation Strategy

Subtle focus/scale/fade/slide transitions only. Avoid particle effects, constant background video, heavy blur, huge shadow stacks, complex WebGL.

## 40. Testing Strategy

Stage 1: Chrome, for React/routing/state/API/catalog/metadata/stream-selection logic.
Stage 2: Samsung TV Simulator, for UI and basic TV APIs.
Stage 3 (mandatory): real Samsung OLED hardware — simulator/emulator/real-TV behavior can differ.

## 41. Testing Matrix

Login/logout/account linking, add-on sync/install/configuration, Home, Search, Movie/Series details, Episodes, Stream selection, Playback (pause/seek/resume), Subtitle/Audio selection, Network failure, Add-on failure, Invalid stream, Unsupported codec, TV restart, App restart, Account logout. Also: 4K/1080p/HDR/HLS/DASH/direct MP4/subtitles, long movies/series, large libraries, many add-ons.

## 42. Playback Compatibility Test Suite

An internal developer page testing MP4/HLS/DASH/WebM/various codecs/HDR/audio codecs/subtitles, reporting network/format/mime/codec/result/error/start-time/buffer-time per case. Maintain against the TVs you intend to support.

## 43. Debugging

UI problems -> browser console. API problems -> network logs. TV API problems -> Tizen logs. Playback problems -> player diagnostics. TV-specific problems -> real-device test. Use Samsung's Web Inspector / the VS Code extension's device debugging.

## 44. Development Milestones

1. App launches, remote nav, basic UI.
2. Add-on client, manifest loading, catalog, meta.
3. Account linking, add-on sync, library.
4. Stream resolution and selection.
5. Samsung video playback, HLS, direct streams, subtitles.
6. Series playback, resume, next episode.
7. Performance, error handling, offline mode.
8. Packaging, signing, TV testing.
9. Samsung certification, beta, public release.

## 45. Recommended Project Repository

```
harbor-tizen/
|-- README.md
|-- LICENSE
|-- package.json
|-- tsconfig.json
|-- vite.config.ts
|-- config.xml
|-- public/
|   |-- icons/
|   `-- images/
|-- src/
|   |-- app/
|   |-- components/
|   |-- screens/
|   |-- navigation/
|   |-- player/
|   |   |-- TizenVideoPlayer.ts
|   |   |-- PlaybackManager.ts
|   |   |-- SubtitleManager.ts
|   |   `-- AudioManager.ts
|   |-- stremio/
|   |   |-- addon-client/
|   |   |-- account/
|   |   |-- catalog/
|   |   |-- metadata/
|   |   |-- streams/
|   |   `-- subtitles/
|   |-- storage/
|   |-- tizen/
|   |   |-- remote.ts
|   |   |-- lifecycle.ts
|   |   `-- device.ts
|   |-- state/
|   |-- types/
|   `-- utils/
`-- tests/
    |-- addon/
    |-- catalog/
    |-- metadata/
    |-- streams/
    `-- player/
```

## 46. Testing the Stremio Protocol Independently

Build a standalone manifest -> catalog -> meta -> stream -> subtitle test tool before wiring it into the TV UI, so a playback failure can be isolated to add-on vs. stream resolver vs. Samsung player.

## 47. Use Existing Open-Source Projects as References

Study Harbor, Stremio Web, the Stremio Addon SDK, and the Stremio add-on client library — but review each project's license before incorporating any code.

## 48. Licensing

Keep a license inventory (project code, Harbor code, Stremio code, npm packages, icons, fonts, images, player libraries) recording package/version/license/source/modification and attribution requirements, before any public release.

## 49. App Name

Don't imply official Stremio ownership or affiliation. Harbor itself is explicit that it's independent and unaffiliated with Stremio.

## 50. Initial MVP

Tizen install, TV UI, remote control, Stremio account linking, add-on sync, manifest loading, catalogs, metadata, search, stream selection, basic playback, resume, basic subtitles, settings. Not yet: advanced recommendations, AI, custom download manager, complex transcoding, advanced shaders, cross-device casting.

**Update:** a torrent playback path (WebTorrent, best-effort, WSS-trackers-only — see `src/player/TorrentStreamManager.ts` and the README's Video player section) was added in this repo alongside hls.js/dash.js adaptive-streaming support, ahead of where this MVP list originally put it.

## 51. Phase 2 Features

Advanced stream ranking, 4K/HDR detection, better subtitles, multiple audio tracks, automatic next episode, watch history, advanced library, favorites, custom home rows, themes, parental controls, profiles, performance work.

## 52. Phase 3 Features

AI/natural-language search, personalized recommendations, Trakt/TMDB integrations, watchlist integrations, smart stream filtering, playback statistics, phone remote, QR-based phone remote.

## 53. Installing the App on Your Own Samsung TV

Build -> certificate -> signed .wgt -> Developer Mode on TV -> same network -> add TV to Device Manager -> install/launch -> debug on TV. USB installation is not supported by Samsung for security reasons.

## 54. Public Distribution

Samsung Seller Office -> register -> upload package -> configure model groups -> screenshots/description/tester instructions -> submit -> Samsung testing -> fix defects if required -> approval -> Samsung Apps TV.

## 55. Distribution Strategy

Private development -> own TV -> friends/test TVs -> closed beta -> Samsung beta distribution -> public release. Don't submit the first prototype to Samsung — stabilize playback and add-on compatibility first.

## 56. Final Architecture

```
                        USER
                         |
                         v
                 SAMSUNG OLED TV
                         |
                 TIZEN WEB APP
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
    React UI       Stremio Client      Tizen APIs
        |                |                |
        |         +------+------+         |
        |         |      |      |         |
        |      Account Addons Library     |
        |         |      |      |         |
        |         +------+------+         |
        |                |                |
        |         Stremio Protocol        |
        |                |                |
        |        +-------+--------+       |
        |        |       |        |       |
        |      Catalog  Meta    Stream  Subtitle
        |                           |
        +---------------------------+
                                    |
                                    v
                              Stream Resolver
                                    |
                                    v
                            Samsung TV Player
                                    |
                                    v
                                  VIDEO
```

## 57. Definition of Done

App launches on Samsung OLED and can be signed/installed; remote navigation, Home, account linking, add-on sync, library, search, metadata, catalogs, stream retrieval/ranking, compatible playback, graceful failure for unsupported streams, HLS, subtitles, resume, series/episodes, next episode all work; the app survives network and add-on failures without one add-on crashing the UI; performance is acceptable; privacy policy exists; licenses are documented; Samsung certification requirements are satisfied.

## 58. Recommended Development Order

1. Identify exact Samsung TV model and Tizen version.
2. Install VS Code + Tizen TV extension + Samsung TV SDK.
3. Enable Developer Mode on TV.
4. Create the empty Tizen Web application. **(done in this repo)**
5. Build and launch it on the actual TV.
6. Implement remote-control navigation. **(done in this repo, browser-tested; needs real-TV verification)**
7. Build the basic Harbor-style UI. **(Milestone-1 placeholder screens done)**
8. Implement the Stremio add-on protocol client. **(done in this repo)**
9. Load a real add-on manifest. **(done — Add-ons screen installs by manifest URL)**
10. Display catalogs. **(done — CatalogAggregator + Home rows)**
11. Display metadata/details. **(done — MetadataAggregator + Details screen)**
12. Implement search. **(done — SearchService + Search screen)**
13. Implement account linking. **(partial — email/password login against the confirmed api.strem.io contract; the QR/short-code TV-pairing flow's backend couldn't be verified from public sources, so it's not implemented — see Risk 1)**
14. Implement add-on synchronization. **(done — one-way pull/push via addonCollectionGet/addonCollectionSet, not a bidirectional merge)**
15. Implement library synchronization. **(not started — Stremio's library-sync API is a separate delta-sync endpoint outside this research pass)**
16. Implement stream resolution. **(done — StreamResolver/Normalizer + Stream Selection screen)**
17. Build the Samsung TV video player. **(done — HTML5-video baseline + hls.js/dash.js MSE fallback + WebTorrent for torrent/infoHash streams, all dynamically imported so non-video screens never pay for them)**
18. Test direct MP4 playback. **(done in a real browser; needs real-TV verification)**
19. Test HLS. **(hls.js integrated with a native-first fallback; wiring/error-path verified against a public test stream, but this sandbox's outbound network policy blocks every candidate CDN at the TLS layer, so actual segment-level decode is unverified — real HLS support (native or hls.js) unverified without a Tizen TV)**
20. Test DASH/MSE where applicable. **(dash.js integrated the same way; same sandbox network caveat as HLS above — unverified without real network access or a Tizen TV)**
21. Implement subtitles. **(done — SubtitleAggregator + SRT-to-VTT conversion + Player screen panel; ASS/SSA intentionally unsupported)**
22. Implement audio selection. **(done — AudioManager wraps AudioTrackList; UI only appears when >1 track is actually reported)**
23. Implement resume. **(done — position saved every ~7s + on pause/unmount, resumed on reopen)**
24. Implement series/episode playback. **(done — Details screen lists episodes; Player shows an "Up Next" countdown that auto-advances)**
25. Implement stream ranking. **(done — StreamRanker, text-heuristic based)**
26. Implement error handling. **(done — per-screen + root React error boundaries, offline detection/banner, cached-catalog fallback on Home; see section 36)**
27. Optimize memory/network/image loading. **(partial — lazy `<img loading="lazy">` on posters; no list virtualization or request cancellation yet)**
28. Test on real Samsung OLED hardware.
29. Test multiple Samsung/Tizen versions.
30. Create production certificate/signing process.
31. Build production .wgt.
32. Create Samsung Seller Office listing.
33. Run Samsung pre-tests.
34. Submit beta.
35. Fix compatibility defects.
36. Submit public release.

## 59. Most Important Technical Risks

**Risk 1 — Stremio account synchronization.** Verify the sync mechanism is currently supported and appropriate for an independent client before designing around it; don't build around an undocumented private endpoint.

**Risk 2 — Samsung playback.** The biggest engineering risk: a stream returned by an add-on is not automatically playable on Tizen. Test real streams early.

**Risk 3 — Add-on variability.** Add-ons differ wildly in speed, stability, redirect behavior, and DRM dependence. The client must isolate failures.

## 60. The Best Starting Point

Study Harbor's architecture/UI/features, study Stremio Web's account/client behavior, build an interoperable add-on layer against the open Stremio protocol, and build the TV UI/player against Samsung Tizen — rather than trying to compile Harbor's desktop stack for Samsung directly.
