import type { CatalogRow } from "@/stremio/catalog/CatalogAggregator";
import { readStorage, writeStorage } from "./localStorage";

const STORAGE_KEY = "homeCatalogCache";

interface CachedHomeCatalog {
  rows: CatalogRow[];
  updatedAt: number;
}

/** Only rows that actually returned items are worth caching — a cached error message is useless. */
export function cacheHomeCatalogRows(rows: CatalogRow[]): void {
  const withItems = rows.filter((r) => r.items.length > 0);
  if (withItems.length === 0) return;
  writeStorage<CachedHomeCatalog>(STORAGE_KEY, { rows: withItems, updatedAt: Date.now() });
}

export function readCachedHomeCatalogRows(): CachedHomeCatalog | undefined {
  return readStorage<CachedHomeCatalog>(STORAGE_KEY);
}
