import type { AddonClient } from "@/stremio/addon-client/AddonClient";
import type { Subtitle } from "@/stremio/addon-client/types";
import type { InstalledAddon } from "@/types/addon";

export interface AggregatedSubtitle extends Subtitle {
  source: string; // add-on name, or "stream" for ones embedded directly in the resolved stream
}

function supportsSubtitles(addon: InstalledAddon, type: string): boolean {
  return addon.manifest.resources.some((r) =>
    typeof r === "string" ? r === "subtitles" : r.name === "subtitles" && r.types.includes(type),
  );
}

/**
 * Collects subtitles from every add-on that declares subtitle support for
 * the type, plus any subtitles embedded directly in the resolved stream
 * object (the protocol allows both — docs/PROJECT_PLAN.md section 23). One
 * add-on failing doesn't drop subtitles from another.
 */
export async function aggregateSubtitles(
  addons: InstalledAddon[],
  client: AddonClient,
  type: string,
  id: string,
  streamSubtitles: Subtitle[] = [],
): Promise<AggregatedSubtitle[]> {
  const candidates = addons.filter((a) => a.enabled && supportsSubtitles(a, type));

  const results = await Promise.allSettled(
    candidates.map((addon) => client.getSubtitles(addon.manifest, addon.transportUrl, type, id)),
  );

  const aggregated: AggregatedSubtitle[] = streamSubtitles.map((s) => ({ ...s, source: "stream" }));

  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const addon = candidates[index];
    for (const subtitle of result.value) {
      aggregated.push({ ...subtitle, source: addon.manifest.name });
    }
  });

  return aggregated;
}
