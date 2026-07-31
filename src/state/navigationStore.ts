import { create } from "zustand";

// Final nav will be Home / Discover / Search / Library / Add-ons / Settings
// (see docs/PROJECT_PLAN.md section 9). Milestone 1 only wires up enough
// screens to prove the app shell, remote nav, and player pipeline work.
export type ScreenId = "home" | "settings" | "testPlayer" | "testRemote";

interface NavigationState {
  screen: ScreenId;
  goTo: (screen: ScreenId) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  screen: "home",
  goTo: (screen) => set({ screen }),
}));
