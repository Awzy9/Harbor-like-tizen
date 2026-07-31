import type { AddonManifest } from "@/stremio/addon-client/types";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import type { InstalledAddon } from "@/types/addon";
import { callStremioApi, StremioApiError } from "./StremioApiClient";
import { clearSession, persistSession, readSession } from "./session";
import type { AuthSession, LibraryItem, LoginCredentials, StremioAccountService, UserProfile } from "./types";

interface StremioUserResult {
  _id: string;
  email?: string;
}

interface LoginResult {
  authKey: string;
  user: StremioUserResult;
}

interface RemoteAddonDescriptor {
  transportUrl: string;
  manifest: AddonManifest;
}

interface AddonCollectionGetResult {
  addons: RemoteAddonDescriptor[];
}

function requireSession(): AuthSession {
  const session = readSession();
  if (!session) throw new StremioApiError("Not logged in");
  return session;
}

/**
 * Implements the confirmed subset of Stremio's account API (see
 * StremioApiClient.ts for what "confirmed" means here): email/password
 * login, profile, and one-way add-on collection pull/push. Deliberately
 * does not attempt the QR/short-code TV pairing flow or library sync —
 * both need their own verified contract before being built.
 */
export class StremioApiAccountService implements StremioAccountService {
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const result = await callStremioApi<LoginResult>("login", credentials);
    const session: AuthSession = { authKey: result.authKey, userId: result.user._id };
    persistSession(session);
    return session;
  }

  async logout(): Promise<void> {
    const session = readSession();
    if (session) {
      // Best-effort — the local session is cleared either way, since a
      // failed logout call server-side shouldn't leave the app stuck
      // "logged in" from the user's perspective.
      await callStremioApi("logout", {}, session.authKey).catch(() => undefined);
    }
    clearSession();
  }

  async getUserProfile(): Promise<UserProfile> {
    const session = requireSession();
    const user = await callStremioApi<StremioUserResult>("getUser", {}, session.authKey);
    return { id: user._id, email: user.email };
  }

  /** Fetches the remote add-on collection. Does not modify local state — callers decide whether/how to merge (see AccountScreen). */
  async getInstalledAddons(): Promise<InstalledAddon[]> {
    const session = requireSession();
    const result = await callStremioApi<AddonCollectionGetResult>(
      "addonCollectionGet",
      { update: true, addFromURL: [] },
      session.authKey,
    );
    return result.addons.map((addon, index) => ({
      transportUrl: addon.transportUrl,
      manifest: addon.manifest,
      enabled: true,
      installedAt: Date.now(),
      order: index,
    }));
  }

  /** One-way push of the current local add-on list up to the Stremio account — not a merge with whatever's already there remotely. */
  async syncAddons(): Promise<void> {
    const session = requireSession();
    const addons: RemoteAddonDescriptor[] = addonManager
      .list()
      .filter((a) => a.enabled)
      .map((a) => ({ transportUrl: a.transportUrl, manifest: a.manifest }));
    await callStremioApi("addonCollectionSet", { addons }, session.authKey);
  }

  getLibrary(): Promise<LibraryItem[]> {
    return Promise.reject(
      new Error(
        "getLibrary() is not implemented — Stremio's library-sync API is a separate delta-sync endpoint that wasn't verified in the account-API research pass (see docs/PROJECT_PLAN.md section 13/59).",
      ),
    );
  }
}
