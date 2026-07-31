import { useEffect, useState } from "react";
import { FocusableItem } from "@/components/FocusableItem";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import { addonClient } from "@/stremio/addon-client/addonClientInstance";
import { getAggregatedMeta } from "@/stremio/metadata/MetadataAggregator";
import type { Meta, MetaVideo } from "@/stremio/addon-client/types";
import { useNavigationStore } from "@/state/navigationStore";
import { getLibraryItem, setFavorited, setWatched } from "@/storage/library";
import "./DetailsScreen.css";

interface DetailsScreenProps {
  addonUrl: string;
  type: string;
  id: string;
}

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; meta: Meta };

export function DetailsScreen({ addonUrl, type, id }: DetailsScreenProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [libraryFlags, setLibraryFlags] = useState({ favorited: false, watched: false });
  const goTo = useNavigationStore((s) => s.goTo);

  useEffect(() => {
    if (state.kind !== "ready") return;
    const item = getLibraryItem(addonUrl, type, state.meta.id);
    setLibraryFlags({ favorited: item?.favorited ?? false, watched: item?.watched ?? false });
  }, [state, addonUrl, type]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    const preferredAddon = addonManager.list().find((a) => a.transportUrl === addonUrl);
    if (!preferredAddon) {
      setState({ kind: "error", message: "This add-on is no longer installed." });
      return;
    }

    getAggregatedMeta(preferredAddon, addonManager.list(), addonClient, type, id)
      .then(({ meta }) => {
        if (!cancelled) setState({ kind: "ready", meta });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: "error", message: err instanceof Error ? err.message : "Failed to load" });
      });

    return () => {
      cancelled = true;
    };
  }, [addonUrl, type, id]);

  if (state.kind === "loading") return <p className="text-dim">Loading…</p>;
  if (state.kind === "error") return <p className="details-screen__error">{state.message}</p>;

  const { meta } = state;

  function toggleFavorite() {
    const updated = setFavorited({ addonUrl, type, contentId: meta.id, title: meta.name, poster: meta.poster }, !libraryFlags.favorited);
    setLibraryFlags({ favorited: updated.favorited, watched: updated.watched });
  }

  function toggleWatched() {
    const updated = setWatched({ addonUrl, type, contentId: meta.id, title: meta.name, poster: meta.poster }, !libraryFlags.watched);
    setLibraryFlags({ favorited: updated.favorited, watched: updated.watched });
  }

  return (
    <div className="details-screen" style={meta.background ? { backgroundImage: `url(${meta.background})` } : undefined}>
      <div className="details-screen__scrim">
        <div className="details-screen__content">
          <h1>{meta.name}</h1>
          <p className="text-dim">
            {[meta.releaseInfo, meta.runtime, meta.genres?.join(", ")].filter(Boolean).join(" · ")}
          </p>
          {meta.description && <p className="details-screen__description">{meta.description}</p>}

          <div className="details-screen__library-actions">
            <FocusableItem
              id="details-favorite"
              className="details-screen__library-button"
              selected={libraryFlags.favorited}
              onEnter={toggleFavorite}
            >
              {libraryFlags.favorited ? "★ Favorited" : "☆ Add to Favorites"}
            </FocusableItem>
            <FocusableItem
              id="details-watched"
              className="details-screen__library-button"
              selected={libraryFlags.watched}
              onEnter={toggleWatched}
            >
              {libraryFlags.watched ? "✓ Watched" : "Mark Watched"}
            </FocusableItem>
          </div>

          {meta.videos && meta.videos.length > 0 ? (
            <>
              <h2>Episodes</h2>
              <div className="details-screen__episodes">
                {(() => {
                  const sorted = sortVideos(meta.videos);
                  return sorted.map((video, index) => {
                    const next = sorted[index + 1];
                    const nextEpisode = next
                      ? { addonUrl, type, id: next.id, title: next.title || meta.name }
                      : undefined;
                    return (
                      <FocusableItem
                        key={video.id}
                        id={`episode-${video.id}`}
                        className="details-screen__episode"
                        onEnter={() =>
                          goTo({
                            name: "streamSelect",
                            addonUrl,
                            type,
                            id: video.id,
                            title: video.title || meta.name,
                            poster: video.thumbnail ?? meta.poster,
                            nextEpisode,
                          })
                        }
                      >
                        <div className="details-screen__episode-title">
                          {video.season !== undefined && video.episode !== undefined
                            ? `S${video.season}E${video.episode} · `
                            : ""}
                          {video.title}
                        </div>
                      </FocusableItem>
                    );
                  });
                })()}
              </div>
            </>
          ) : (
            <FocusableItem
              id="details-watch"
              className="details-screen__watch"
              autoFocus
              onEnter={() => goTo({ name: "streamSelect", addonUrl, type, id: meta.id, title: meta.name, poster: meta.poster })}
            >
              Watch
            </FocusableItem>
          )}
        </div>
      </div>
    </div>
  );
}

function sortVideos(videos: MetaVideo[]): MetaVideo[] {
  return [...videos].sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
}
