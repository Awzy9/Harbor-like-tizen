import { useState } from "react";
import { FocusableTextField } from "@/components/FocusableTextField";
import { PosterTile } from "@/components/PosterTile";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import { addonClient } from "@/stremio/addon-client/addonClientInstance";
import { searchAddons, type SearchResultItem } from "@/stremio/catalog/SearchService";
import { useNavigationStore } from "@/state/navigationStore";
import "./SearchScreen.css";

type SearchState = { kind: "idle" } | { kind: "searching" } | { kind: "results"; items: SearchResultItem[] };

export function SearchScreen() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const goTo = useNavigationStore((s) => s.goTo);

  async function runSearch() {
    if (!query.trim()) return;
    setState({ kind: "searching" });
    const items = await searchAddons(addonManager.list(), addonClient, query);
    setState({ kind: "results", items });
  }

  return (
    <div className="search-screen">
      <FocusableTextField
        id="search-input"
        autoFocus
        value={query}
        onChange={setQuery}
        onSubmit={runSearch}
        placeholder="Search installed add-ons…"
      />

      {state.kind === "searching" && <p className="text-dim">Searching…</p>}

      {state.kind === "results" && (
        <>
          {state.items.length === 0 ? (
            <p className="text-dim">No results.</p>
          ) : (
            <div className="search-screen__results">
              {state.items.map(({ item, addonUrl }) => (
                <PosterTile
                  key={`${addonUrl}::${item.id}`}
                  id={`search-${addonUrl}-${item.id}`}
                  meta={item}
                  onEnter={() => goTo({ name: "details", addonUrl, type: item.type, id: item.id })}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
