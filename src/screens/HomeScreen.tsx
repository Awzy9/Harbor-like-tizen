import { useEffect, useState } from "react";
import { PosterTile } from "@/components/PosterTile";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import { addonClient } from "@/stremio/addon-client/addonClientInstance";
import { aggregateCatalogRows, type CatalogRow } from "@/stremio/catalog/CatalogAggregator";
import { useNavigationStore } from "@/state/navigationStore";
import "./HomeScreen.css";

export function HomeScreen() {
  const [rows, setRows] = useState<CatalogRow[] | undefined>(undefined);
  const goTo = useNavigationStore((s) => s.goTo);

  useEffect(() => {
    let cancelled = false;
    aggregateCatalogRows(addonManager.list(), addonClient).then((result) => {
      if (!cancelled) setRows(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === undefined) {
    return <p className="text-dim">Loading catalogs…</p>;
  }

  if (addonManager.list().length === 0) {
    return (
      <div className="home-screen__empty">
        <p>No add-ons installed yet.</p>
        <p className="text-dim">Go to Add-ons to install one by its manifest URL.</p>
      </div>
    );
  }

  return (
    <div className="home-screen">
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
