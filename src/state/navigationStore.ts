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
  | { name: "addons" }
  | { name: "settings" }
  | { name: "account" }
  | { name: "testPlayer" }
  | { name: "testRemote" }
  | { name: "diagnostics" }
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

interface NavigationState {
  screen: Screen;
  goTo: (screen: Screen) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  screen: { name: "home" },
  goTo: (screen) => set({ screen }),
}));
