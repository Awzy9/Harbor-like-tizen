import type { AddonManifest } from "@/stremio/addon-client/types";

export interface InstalledAddon {
  transportUrl: string;
  manifest: AddonManifest;
  enabled: boolean;
  installedAt: number;
  order: number;
}
