import type { AddonClient } from "@/stremio/addon-client/AddonClient";
import type { MetaPreview } from "@/stremio/addon-client/types";
import type { InstalledAddon } from "@/types/addon";

export interface SearchResultItem {
  item: MetaPreview;
  addonUrl: string;
  addonName: string;
}

/**
 * Searches every catalog that declares support for it — the Stremio add-on
 * SDK documents catalog requests as used for both browsing and search, via
 * an `extra` entry named "search" on the catalog descriptor
 * (docs/PROJECT_PLAN.md section 18). Add-ons/catalogs that don't declare
 * search support are skipped rather than queried anyway.
 */
export async function searchAddons(
  addons: InstalledAddon[],
  client: AddonClient,
  query: string,
): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const jobs = addons
    .filter((addon) => addon.enabled)
    .flatMap((addon) =>
      addon.manifest.catalogs
        .filter((catalog) => catalog.extra?.some((e) => e.name === "search"))
        .map((catalog) => ({ addon, catalog })),
    );

  const results = await Promise.allSettled(
    jobs.map(({ addon, catalog }) =>
      client.getCatalog(addon.manifest, addon.transportUrl, catalog.type, catalog.id, { search: trimmed }),
    ),
  );

  const items: SearchResultItem[] = [];
  const seen = new Set<string>();

  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const { addon } = jobs[index];
    for (const item of result.value) {
      const dedupeKey = `${item.type}:${item.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      items.push({ item, addonUrl: addon.transportUrl, addonName: addon.manifest.name });
    }
  });

  return items;
}
