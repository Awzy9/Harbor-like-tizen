import { getTizenGlobal } from "./env";

export type VisibilityHandler = (visible: boolean) => void;

/** Fires when the TV suspends/resumes the app (e.g. HDMI switch, Smart Hub). */
export function subscribeToVisibility(handler: VisibilityHandler): () => void {
  const onChange = () => handler(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** Exits the app. On a real TV this is the only way back to Smart Hub from
 *  the root screen — pressing Back there must not just be swallowed by React
 *  Router or left with no effect. */
export function exitApplication(): void {
  const tizen = getTizenGlobal();
  if (tizen) {
    tizen.application.getCurrentApplication().exit();
    return;
  }
  console.info("[lifecycle] exitApplication() called outside Tizen runtime — no-op");
}
