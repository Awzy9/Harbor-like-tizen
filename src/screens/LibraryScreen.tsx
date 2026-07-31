import { useState } from "react";
import { PosterTile } from "@/components/PosterTile";
import { FocusableItem } from "@/components/FocusableItem";
import { getAllLibraryItems } from "@/storage/library";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import { useNavigationStore } from "@/state/navigationStore";
import "./LibraryScreen.css";

type Filter = "all" | "favorites" | "watched";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites" },
  { id: "watched", label: "Watched" },
];

const EMPTY_MESSAGE: Record<Filter, string> = {
  all: "Nothing in your library yet — favorite a title or mark it watched from its Details page.",
  favorites: "No favorites yet.",
  watched: "Nothing marked watched yet.",
};

export function LibraryScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const goTo = useNavigationStore((s) => s.goTo);

  // A library item whose add-on was since removed/disabled has nothing to
  // link to (Details would just fail to load) — hide it rather than show a
  // dead tile, same rule Continue Watching already applies on Home.
  const installedEnabled = new Set(addonManager.list().filter((a) => a.enabled).map((a) => a.transportUrl));
  const items = getAllLibraryItems()
    .filter((item) => installedEnabled.has(item.addonUrl))
    .filter((item) => (filter === "favorites" ? item.favorited : filter === "watched" ? item.watched : true));

  return (
    <div className="library-screen">
      <h1>Library</h1>

      <div className="library-screen__filters">
        {FILTERS.map((f, index) => (
          <FocusableItem
            key={f.id}
            id={`library-filter-${f.id}`}
            className="library-screen__filter"
            selected={filter === f.id}
            autoFocus={index === 0}
            onEnter={() => setFilter(f.id)}
          >
            {f.label}
          </FocusableItem>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-dim">{EMPTY_MESSAGE[filter]}</p>
      ) : (
        <div className="library-screen__grid">
          {items.map((item) => (
            <PosterTile
              key={`${item.addonUrl}::${item.type}::${item.contentId}`}
              id={`library-${item.addonUrl}::${item.contentId}`}
              meta={{ id: item.contentId, type: item.type, name: item.title, poster: item.poster }}
              badge={item.watched ? "Watched" : item.favorited ? "Favorite" : undefined}
              onEnter={() => goTo({ name: "details", addonUrl: item.addonUrl, type: item.type, id: item.contentId })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
