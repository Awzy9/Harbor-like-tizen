import { useEffect, useState } from "react";

/**
 * Tracks navigator.onLine, which Tizen's WebKit runtime (like any modern
 * browser) keeps in sync with actual network reachability. This only
 * detects "no network interface" style outages, not "network up but this
 * particular add-on is unreachable" — that's handled per-request by
 * AddonClient's own timeout/error handling instead.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
