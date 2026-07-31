import { useEffect, useState } from "react";
import { FocusableItem } from "@/components/FocusableItem";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import { addonClient } from "@/stremio/addon-client/addonClientInstance";
import { resolveStreams, type StreamResolutionResult } from "@/stremio/streams/StreamResolver";
import { detectCodecHint, detectHdrHint } from "@/stremio/streams/StreamRanker";
import { useNavigationStore, type NextEpisodeRef } from "@/state/navigationStore";
import type { ResolvedStream } from "@/types/playback";
import "./StreamSelectionScreen.css";

const CODEC_LABELS: Record<string, string> = { h264: "H.264", hevc: "HEVC", vp9: "VP9", av1: "AV1" };

/** Badge list per spec section 41 — only ever shows fields we actually have (or can honestly infer from free text), never fabricated ones like a guessed audio codec/language. */
function streamBadges(stream: ResolvedStream): string[] {
  const text = `${stream.name ?? ""} ${stream.title ?? ""}`;
  const codec = detectCodecHint(text);
  const badges: string[] = [];
  if (stream.quality) badges.push(stream.quality);
  if (codec) badges.push(CODEC_LABELS[codec]);
  if (detectHdrHint(text)) badges.push("HDR");
  badges.push(stream.protocol === "torrent" ? "Torrent" : "Direct");
  return badges;
}

interface StreamSelectionScreenProps {
  addonUrl: string;
  type: string;
  id: string;
  title: string;
  poster?: string;
  nextEpisode?: NextEpisodeRef;
}

export function StreamSelectionScreen({ addonUrl, type, id, title, poster, nextEpisode }: StreamSelectionScreenProps) {
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
                onEnter={() => {
                  // Chosen stream first, then the rest of the ranked list (minus
                  // the chosen one) as the automatic fallback queue if it fails —
                  // see PlaybackFallbackManager.
                  const streams = [stream, ...result.streams.filter((_, i) => i !== index)];
                  goTo({ name: "player", streams, addonUrl, contentId: id, title, type, poster, nextEpisode });
                }}
              >
                {index === 0 && <div className="stream-selection-screen__item-badge">RECOMMENDED</div>}
                <div className="stream-selection-screen__item-title">{stream.title ?? stream.name ?? "Stream"}</div>
                <div className="text-dim stream-selection-screen__item-meta">
                  {[...streamBadges(stream), addonName].filter(Boolean).join(" · ")}
                </div>
              </FocusableItem>
            );
          })}
        </ul>
      )}
    </div>
  );
}
