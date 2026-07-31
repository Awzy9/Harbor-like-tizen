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

/**
 * Seam between the app and Stremio's account backend. Intentionally NOT
 * implemented yet: the public Stremio add-on protocol does not define
 * account authentication (docs/PROJECT_PLAN.md section 13/59 Risk 1) — a
 * real implementation needs to be based on Stremio Web's current
 * open-source login/sync flow, researched and reviewed before it's wired
 * into the UI, not guessed at from this plan alone.
 */
export interface StremioAccountService {
  login(): Promise<AuthSession>;
  logout(): Promise<void>;
  getInstalledAddons(): Promise<InstalledAddon[]>;
  getLibrary(): Promise<LibraryItem[]>;
  syncAddons(): Promise<void>;
  getUserProfile(): Promise<UserProfile>;
}
