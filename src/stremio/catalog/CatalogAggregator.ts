import type { AddonClient } from "@/stremio/addon-client/AddonClient";
import type { MetaPreview } from "@/stremio/addon-client/types";
import type { InstalledAddon } from "@/types/addon";

export interface CatalogRow {
  key: string;
  title: string;
  addonName: string;
  addonUrl: string;
  type: string;
  catalogId: string;
  items: MetaPreview[];
  error?: string;
}

/**
 * Fetches one row per (enabled add-on × declared catalog), in parallel, with
 * per-row failure isolation (docs/PROJECT_PLAN.md section 16) — a slow or
 * broken add-on shows up as a single failed row with an error message, never
 * as a blocked or broken Home screen. No cross-add-on merging/dedup yet
 * (phase 2); each catalog the add-on declares gets its own row for now.
 */
export async function aggregateCatalogRows(addons: InstalledAddon[], client: AddonClient): Promise<CatalogRow[]> {
  const jobs = addons
    .filter((addon) => addon.enabled)
    .flatMap((addon) => addon.manifest.catalogs.map((catalog) => ({ addon, catalog })));

  const results = await Promise.allSettled(
    jobs.map(async ({ addon, catalog }) => {
      const items = await client.getCatalog(addon.manifest, addon.transportUrl, catalog.type, catalog.id);
      return items;
    }),
  );

  return results.map((result, index) => {
    const { addon, catalog } = jobs[index];
    const key = `${addon.transportUrl}::${catalog.type}::${catalog.id}`;
    const title = catalog.name ?? `${catalog.type} · ${catalog.id}`;

    if (result.status === "fulfilled") {
      return { key, title, addonName: addon.manifest.name, addonUrl: addon.transportUrl, type: catalog.type, catalogId: catalog.id, items: result.value };
    }

    return {
      key,
      title,
      addonName: addon.manifest.name,
      addonUrl: addon.transportUrl,
      type: catalog.type,
      catalogId: catalog.id,
      items: [],
      error: result.reason instanceof Error ? result.reason.message : "Failed to load catalog",
    };
  });
}
