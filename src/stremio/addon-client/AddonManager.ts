import type { InstalledAddon } from "@/types/addon";
import { readStorage, writeStorage } from "@/storage/localStorage";
import { AddonClient } from "./AddonClient";

const STORAGE_KEY = "installedAddons";

/**
 * Owns the locally persisted add-on list. Deliberately dumb: no hard-coded
 * add-ons anywhere (docs/PROJECT_PLAN.md section 12) — every add-on the app
 * knows about got there because a manifest URL was installed, either by the
 * user directly or via account synchronization (src/stremio/account/).
 */
export class AddonManager {
  private addons: InstalledAddon[];

  constructor(private readonly client: AddonClient = new AddonClient()) {
    this.addons = readStorage<InstalledAddon[]>(STORAGE_KEY) ?? [];
  }

  list(): InstalledAddon[] {
    return [...this.addons].sort((a, b) => a.order - b.order);
  }

  async install(transportUrl: string): Promise<InstalledAddon> {
    const existing = this.addons.find((a) => a.transportUrl === transportUrl);
    if (existing) return existing;

    const manifest = await this.client.loadManifest(transportUrl);
    const installed: InstalledAddon = {
      transportUrl,
      manifest,
      enabled: true,
      installedAt: Date.now(),
      order: this.addons.length,
    };

    this.addons.push(installed);
    this.persist();
    return installed;
  }

  remove(transportUrl: string): void {
    this.addons = this.addons.filter((a) => a.transportUrl !== transportUrl);
    this.persist();
  }

  setEnabled(transportUrl: string, enabled: boolean): void {
    const addon = this.addons.find((a) => a.transportUrl === transportUrl);
    if (addon) {
      addon.enabled = enabled;
      this.persist();
    }
  }

  async refreshManifest(transportUrl: string): Promise<void> {
    const addon = this.addons.find((a) => a.transportUrl === transportUrl);
    if (!addon) return;
    addon.manifest = await this.client.loadManifest(transportUrl);
    this.persist();
  }

  reorder(transportUrl: string, newOrder: number): void {
    const addon = this.addons.find((a) => a.transportUrl === transportUrl);
    if (addon) {
      addon.order = newOrder;
      this.persist();
    }
  }

  private persist(): void {
    writeStorage(STORAGE_KEY, this.addons);
  }
}
