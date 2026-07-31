import { create } from "zustand";
import type { ResolvedStream } from "@/types/playback";

// Final nav will be Home / Discover / Search / Library / Add-ons / Settings
// (see docs/PROJECT_PLAN.md section 9). Screens that need context (which
// title, which addon, which stream) carry it as part of the screen value
// itself rather than through a separate params store, since nothing here
// needs to survive a reload.
export type Screen =
  | { name: "home" }
  | { name: "search" }
  | { name: "library" }
  | { name: "addons" }
  | { name: "settings" }
  | { name: "account" }
  | { name: "testPlayer" }
  | { name: "testRemote" }
  | { name: "diagnostics" }
  | { name: "subtitleSettings" }
  | { name: "details"; addonUrl: string; type: string; id: string }
  | { name: "streamSelect"; addonUrl: string; type: string; id: string; title: string; poster?: string; nextEpisode?: NextEpisodeRef }
  | {
      name: "player";
      /** Ranked fallback queue — the user's chosen stream first, followed by the remaining ranked candidates (see PlaybackFallbackManager). */
      streams: ResolvedStream[];
      /** The meta add-on this content came from, so "Try Another Stream" can return to the same Stream Selection screen. */
      addonUrl: string;
      contentId: string;
      episodeId?: string;
      title: string;
      type: string;
      poster?: string;
      nextEpisode?: NextEpisodeRef;
    };

/** Carried from Details through Stream Selection to the Player so "Next Episode" knows where to go without re-deriving it from meta. */
export interface NextEpisodeRef {
  addonUrl: string;
  type: string;
  id: string;
  title: string;
}

export type ScreenName = Screen["name"];

// Screens reachable only by drilling in from another screen (not the
// top-level nav bar) — Back through these should step one level at a time
// (Player -> Stream Selection -> Details -> Home, per docs/PROJECT_PLAN.md
// section 16), whereas switching between top-level tabs (Home/Search/
// Add-ons/Settings) is peer navigation, not a stack: bouncing between tabs
// and pressing Back should go straight to Home, not replay every tab you
// visited. Exported so App.tsx's nav bar visibility check uses the same list.
export const DRILL_IN_SCREENS: ScreenName[] = [
  "details",
  "streamSelect",
  "player",
  "testPlayer",
  "testRemote",
  "diagnostics",
  "subtitleSettings",
  "account",
];

interface NavigationState {
  screen: Screen;
  /** Screens to return to on Back, most-recent last — only populated while inside a drill-in chain. */
  history: Screen[];
  goTo: (screen: Screen) => void;
  /** Pops one level off the history stack. Returns false (and does nothing) if there's nowhere to go back to — the caller decides the fallback (Home, or exit). */
  goBack: () => boolean;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  screen: { name: "home" },
  history: [],
  goTo: (screen) =>
    set((state) =>
      DRILL_IN_SCREENS.includes(screen.name)
        ? { screen, history: [...state.history, state.screen] }
        : { screen, history: [] },
    ),
  goBack: () => {
    const { history } = get();
    if (history.length === 0) return false;
    const previous = history[history.length - 1];
    set({ screen: previous, history: history.slice(0, -1) });
    return true;
  },
}));
