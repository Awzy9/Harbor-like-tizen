import type { AddonClient } from "@/stremio/addon-client/AddonClient";
import type { InstalledAddon } from "@/types/addon";
import type { ResolvedStream } from "@/types/playback";
import { normalizeStreams } from "./StreamNormalizer";
import { rankStreams } from "./StreamRanker";

export interface StreamResolutionResult {
  streams: ResolvedStream[];
  /** Add-ons that declared stream support but failed — surfaced so the UI can say "X unavailable" without hiding it silently. */
  failedAddons: Array<{ addonName: string; message: string }>;
}

function supportsStream(addon: InstalledAddon, type: string): boolean {
  return addon.manifest.resources.some((r) =>
    typeof r === "string" ? r === "stream" : r.name === "stream" && r.types.includes(type),
  );
}

/**
 * Collects streams for one title/episode across every installed, enabled
 * add-on that declares stream support for the type, normalizes them to
 * directly-playable URLs, and ranks the result (docs/PROJECT_PLAN.md
 * section 19). One add-on failing never blocks streams from another.
 */
export async function resolveStreams(
  addons: InstalledAddon[],
  client: AddonClient,
  type: string,
  id: string,
): Promise<StreamResolutionResult> {
  const candidates = addons.filter((a) => a.enabled && supportsStream(a, type));

  const results = await Promise.allSettled(
    candidates.map((addon) => client.getStreams(addon.manifest, addon.transportUrl, type, id)),
  );

  const streams: ResolvedStream[] = [];
  const failedAddons: StreamResolutionResult["failedAddons"] = [];

  results.forEach((result, index) => {
    const addon = candidates[index];
    if (result.status === "fulfilled") {
      streams.push(...normalizeStreams(result.value, addon.transportUrl));
    } else {
      failedAddons.push({
        addonName: addon.manifest.name,
        message: result.reason instanceof Error ? result.reason.message : "Failed to load streams",
      });
    }
  });

  return { streams: rankStreams(streams), failedAddons };
}
