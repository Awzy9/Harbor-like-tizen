import { useEffect, useState } from "react";
import { FocusableItem } from "@/components/FocusableItem";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import { addonClient } from "@/stremio/addon-client/addonClientInstance";
import { resolveStreams, type StreamResolutionResult } from "@/stremio/streams/StreamResolver";
import { useNavigationStore, type NextEpisodeRef } from "@/state/navigationStore";
import "./StreamSelectionScreen.css";

interface StreamSelectionScreenProps {
  addonUrl: string;
  type: string;
  id: string;
  title: string;
  poster?: string;
  nextEpisode?: NextEpisodeRef;
}

export function StreamSelectionScreen({ type, id, title, poster, nextEpisode }: StreamSelectionScreenProps) {
  const [result, setResult] = useState<StreamResolutionResult | undefined>(undefined);
  const goTo = useNavigationStore((s) => s.goTo);

  useEffect(() => {
    let cancelled = false;
    setResult(undefined);
    resolveStreams(addonManager.list(), addonClient, type, id).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  return (
    <div className="stream-selection-screen">
      <h1>{title}</h1>
      <h2>Available Streams</h2>

      {result === undefined && <p className="text-dim">Resolving streams…</p>}

      {result?.failedAddons.map((f) => (
        <p key={f.addonName} className="stream-selection-screen__error">
          {f.addonName} unavailable: {f.message}
        </p>
      ))}

      {result && result.streams.length === 0 && (
        <p className="text-dim">No playable streams found from your installed add-ons.</p>
      )}

      {result && result.streams.length > 0 && (
        <ul className="stream-selection-screen__list">
          {result.streams.map((stream, index) => {
            const addonName = addonManager.list().find((a) => a.transportUrl === stream.addonId)?.manifest.name;
            return (
              <FocusableItem
                key={`${stream.addonId}-${index}`}
                id={`stream-${index}`}
                className="stream-selection-screen__item"
                autoFocus={index === 0}
                onEnter={() => goTo({ name: "player", stream, contentId: id, title, type, poster, nextEpisode })}
              >
                <div className="stream-selection-screen__item-title">{stream.title ?? stream.name ?? "Stream"}</div>
                <div className="text-dim stream-selection-screen__item-meta">
                  {[stream.quality, addonName].filter(Boolean).join(" · ")}
                </div>
              </FocusableItem>
            );
          })}
        </ul>
      )}
    </div>
  );
}
