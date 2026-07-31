import type { AddonClient } from "@/stremio/addon-client/AddonClient";
import type { Meta } from "@/stremio/addon-client/types";
import type { InstalledAddon } from "@/types/addon";

export class MetadataUnavailableError extends Error {
  constructor(type: string, id: string) {
    super(`No installed add-on could provide metadata for ${type}/${id}`);
    this.name = "MetadataUnavailableError";
  }
}

function supportsMeta(addon: InstalledAddon, type: string): boolean {
  return addon.manifest.resources.some((r) =>
    typeof r === "string" ? r === "meta" : r.name === "meta" && r.types.includes(type),
  );
}

/**
 * Fetches meta for one title, preferring the add-on the catalog entry came
 * from and falling back to any other installed add-on that declares meta
 * support for the type (docs/PROJECT_PLAN.md section 17). Returns the first
 * successful response rather than merging fields across sources — full
 * multi-source field merging is a phase-2 refinement once there's a real
 * need to reconcile conflicting data.
 */
export async function getAggregatedMeta(
  preferredAddon: InstalledAddon,
  allAddons: InstalledAddon[],
  client: AddonClient,
  type: string,
  id: string,
): Promise<{ meta: Meta; addonUrl: string }> {
  const candidates = [
    preferredAddon,
    ...allAddons.filter((a) => a.enabled && a.transportUrl !== preferredAddon.transportUrl && supportsMeta(a, type)),
  ];

  for (const addon of candidates) {
    try {
      const meta = await client.getMeta(addon.manifest, addon.transportUrl, type, id);
      return { meta, addonUrl: addon.transportUrl };
    } catch {
      continue; // try the next candidate — one add-on failing must not block metadata from another
    }
  }

  throw new MetadataUnavailableError(type, id);
}
