import { useEffect, useState } from "react";
import { PosterTile } from "@/components/PosterTile";
import { FocusableItem } from "@/components/FocusableItem";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import { addonClient } from "@/stremio/addon-client/addonClientInstance";
import { aggregateCatalogRows, type CatalogRow } from "@/stremio/catalog/CatalogAggregator";
import { cacheHomeCatalogRows, readCachedHomeCatalogRows } from "@/storage/homeCatalogCache";
import { getAllPlaybackProgress, isPlaybackFinished } from "@/storage/playbackProgress";
import { useNavigationStore } from "@/state/navigationStore";
import "./HomeScreen.css";

function getContinueWatching() {
  const installedEnabled = new Set(addonManager.list().filter((a) => a.enabled).map((a) => a.transportUrl));
  return getAllPlaybackProgress()
    .filter((p) => !isPlaybackFinished(p) && installedEnabled.has(p.addonUrl))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: CatalogRow[]; fromCache: boolean }
  | { kind: "offline-no-cache" };

export function HomeScreen() {
  const cached = readCachedHomeCatalogRows();
  const [state, setState] = useState<LoadState>(
    cached ? { kind: "ready", rows: cached.rows, fromCache: true } : { kind: "loading" },
  );
  const goTo = useNavigationStore((s) => s.goTo);

  function load() {
    setState((prev) => (prev.kind === "ready" ? prev : { kind: "loading" }));
    aggregateCatalogRows(addonManager.list(), addonClient).then((result) => {
      const hasAnyItems = result.some((r) => r.items.length > 0);
      if (hasAnyItems) {
        cacheHomeCatalogRows(result);
        setState({ kind: "ready", rows: result, fromCache: false });
        return;
      }
      // Fetch produced nothing usable — if we already have cached rows on
      // screen, leave them showing rather than replacing good data with a
      // wall of per-row network errors (docs/PROJECT_PLAN.md section 36).
      setState((prev) => (prev.kind === "ready" ? prev : { kind: "offline-no-cache" }));
    });
  }

  useEffect(load, []);

  if (addonManager.list().length === 0) {
    return (
      <div className="home-screen__empty">
        <p>No add-ons installed yet.</p>
        <p className="text-dim">Go to Add-ons to install one by its manifest URL.</p>
      </div>
    );
  }

  if (state.kind === "loading") {
    return <p className="text-dim">Loading catalogs…</p>;
  }

  if (state.kind === "offline-no-cache") {
    return (
      <div className="home-screen__empty">
        <p>You&apos;re offline and there&apos;s nothing cached yet.</p>
        <FocusableItem id="home-retry" autoFocus onEnter={load} className="home-screen__retry">
          Retry
        </FocusableItem>
      </div>
    );
  }

  const { rows, fromCache } = state;
  const continueWatching = getContinueWatching();

  return (
    <div className="home-screen">
      {fromCache && (
        <p className="home-screen__cache-notice text-dim">
          Showing cached results.{" "}
          <FocusableItem id="home-refresh" onEnter={load} className="home-screen__refresh-inline">
            Refresh
          </FocusableItem>
        </p>
      )}
      {continueWatching.length > 0 && (
        <section className="home-row">
          <h2 className="home-row__title">Continue Watching</h2>
          <div className="home-row__items">
            {continueWatching.map((p) => (
              <PosterTile
                key={`${p.addonUrl}::${p.contentId}::${p.episodeId ?? ""}`}
                id={`continue-${p.contentId}`}
                meta={{ id: p.contentId, type: p.type, name: p.title, poster: p.poster }}
                onEnter={() =>
                  goTo({ name: "streamSelect", addonUrl: p.addonUrl, type: p.type, id: p.contentId, title: p.title, poster: p.poster })
                }
              />
            ))}
          </div>
        </section>
      )}
      {rows.map((row) => (
        <section key={row.key} className="home-row">
          <h2 className="home-row__title">
            {row.title} <span className="text-dim home-row__addon-name">· {row.addonName}</span>
          </h2>
          {row.error ? (
            <p className="home-row__error">{row.addonName} unavailable: {row.error}</p>
          ) : row.items.length === 0 ? (
            <p className="text-dim">No items.</p>
          ) : (
            <div className="home-row__items">
              {row.items.map((item) => (
                <PosterTile
                  key={item.id}
                  id={`${row.key}::${item.id}`}
                  meta={item}
                  onEnter={() => goTo({ name: "details", addonUrl: row.addonUrl, type: item.type, id: item.id })}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
