import { useEffect, useState } from "react";
import { subscribeToRemote, type RemoteAction } from "@/tizen/remote";
import { getDeviceInfo } from "@/tizen/device";
import { FocusableItem } from "@/components/FocusableItem";
import "./TestRemoteScreen.css";

const MAX_LOG_ENTRIES = 12;

export function TestRemoteScreen() {
  const [log, setLog] = useState<RemoteAction[]>([]);
  const device = getDeviceInfo();

  useEffect(() => {
    return subscribeToRemote((action) => {
      setLog((prev) => [action, ...prev].slice(0, MAX_LOG_ENTRIES));
    });
  }, []);

  return (
    <div className="test-remote-screen">
      <p className="text-dim">
        Environment: {device.isTizen ? `Tizen ${device.platformVersion ?? "?"}` : "browser (dev mode)"}
      </p>

      <div className="test-remote-screen__grid">
        {Array.from({ length: 3 }).map((_, row) =>
          Array.from({ length: 3 }).map((_, col) => (
            <FocusableItem key={`${row}-${col}`} id={`grid-${row}-${col}`} className="test-remote-screen__cell">
              {row * 3 + col + 1}
            </FocusableItem>
          )),
        )}
      </div>

      <h3>Last {MAX_LOG_ENTRIES} remote actions</h3>
      <ul className="test-remote-screen__log">
        {log.length === 0 && <li className="text-dim">Press a remote key (or arrow keys in browser)…</li>}
        {log.map((action, i) => (
          <li key={i}>{action}</li>
        ))}
      </ul>
    </div>
  );
}
