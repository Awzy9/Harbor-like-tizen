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
  | { name: "testPlayer" }
  | { name: "testRemote" }
  | { name: "details"; addonUrl: string; type: string; id: string }
  | { name: "streamSelect"; addonUrl: string; type: string; id: string; title: string; nextEpisode?: NextEpisodeRef }
  | { name: "player"; stream: ResolvedStream; contentId: string; episodeId?: string; title: string; type: string; nextEpisode?: NextEpisodeRef };

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
