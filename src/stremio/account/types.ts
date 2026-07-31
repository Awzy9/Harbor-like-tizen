import type { InstalledAddon } from "@/types/addon";

export interface AuthSession {
  authKey: string;
  userId: string;
  expiresAt?: number;
}

export interface UserProfile {
  id: string;
  email?: string;
}

export interface LibraryItem {
  id: string;
  type: string;
  name: string;
  removed?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Seam between the app and Stremio's account backend. `login`/`logout`/
 * `getUserProfile`/`getInstalledAddons`/`syncAddons` are implemented in
 * StremioApiAccountService against the confirmed api.strem.io contract (see
 * StremioApiClient.ts) — login is email/password only; the TV-friendly
 * QR/short-code pairing flow's backend contract couldn't be verified from
 * public sources, so it's deliberately not implemented (docs/PROJECT_PLAN.md
 * sections 13/59, Risk 1). `getLibrary` remains unimplemented for the same
 * reason: Stremio's library-sync API is a separate, more complex
 * delta-sync endpoint that wasn't part of this research pass.
 */
export interface StremioAccountService {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  getInstalledAddons(): Promise<InstalledAddon[]>;
  getLibrary(): Promise<LibraryItem[]>;
  syncAddons(): Promise<void>;
  getUserProfile(): Promise<UserProfile>;
}
