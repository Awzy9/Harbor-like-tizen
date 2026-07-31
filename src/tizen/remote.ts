import { getTizenGlobal, isTizen } from "./env";

// Arrow keys, Enter, and Back are delivered to any focused element without
// registration. Everything else (media transport, color keys) must be
// explicitly registered with tvinputdevice or the TV runtime swallows it.
const KEYS_REQUIRING_REGISTRATION = [
  "MediaPlayPause",
  "MediaPlay",
  "MediaPause",
  "MediaStop",
  "MediaRewind",
  "MediaFastForward",
  "MediaTrackPrevious",
  "MediaTrackNext",
] as const;

export type RemoteAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "enter"
  | "back"
  | "play"
  | "pause"
  | "playPause"
  | "stop"
  | "rewind"
  | "fastForward"
  | "trackPrevious"
  | "trackNext";

const KEYCODE_TO_ACTION: Record<number, RemoteAction> = {
  37: "left",
  38: "up",
  39: "right",
  40: "down",
  13: "enter",
  10009: "back",
  415: "play",
  19: "pause",
  10252: "playPause",
  413: "stop",
  412: "rewind",
  417: "fastForward",
  10232: "trackPrevious",
  10233: "trackNext",
};

let registered = false;

/** Registers the non-default TV remote keys. No-op outside a Tizen runtime. */
export function registerRemoteKeys(): void {
  if (registered) return;
  registered = true;

  const tizen = getTizenGlobal();
  if (!tizen) return;

  for (const keyName of KEYS_REQUIRING_REGISTRATION) {
    try {
      tizen.tvinputdevice.registerKey(keyName);
    } catch (err) {
      console.warn(`[remote] failed to register key "${keyName}"`, err);
    }
  }
}

export function unregisterRemoteKeys(): void {
  if (!registered) return;
  registered = false;

  const tizen = getTizenGlobal();
  if (!tizen) return;

  for (const keyName of KEYS_REQUIRING_REGISTRATION) {
    try {
      tizen.tvinputdevice.unregisterKey(keyName);
    } catch {
      // Already unregistered or unsupported on this key — safe to ignore.
    }
  }
}

/**
 * Subscribes to remote-control input as normalized RemoteAction events.
 * Works identically in a desktop browser (arrow keys/Enter/Escape) and on a
 * real Tizen TV, so the same navigation code runs in both.
 */
export function subscribeToRemote(handler: (action: RemoteAction) => void): () => void {
  registerRemoteKeys();

  const onKeyDown = (event: KeyboardEvent) => {
    const action = KEYCODE_TO_ACTION[event.keyCode] ?? browserFallback(event);
    if (!action) return;
    event.preventDefault();
    handler(action);
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}

/** Lets desktop-browser development use Escape/Backspace for "back". */
function browserFallback(event: KeyboardEvent): RemoteAction | undefined {
  if (isTizen()) return undefined;
  if (event.key === "Escape" || event.key === "Backspace") return "back";
  if (event.key === " ") return "playPause";
  return undefined;
}
