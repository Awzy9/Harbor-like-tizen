import type { AuthSession } from "./types";
import { readStorage, writeStorage, removeStorage } from "@/storage/localStorage";

const STORAGE_KEY = "stremioSession";

// The authKey is a session token (what Stremio's own apps persist locally
// too), not the password itself — storing it in localStorage matches
// docs/PROJECT_PLAN.md section 15's "no plaintext passwords" bar, which this
// doesn't cross.
export function readSession(): AuthSession | undefined {
  return readStorage<AuthSession>(STORAGE_KEY);
}

export function persistSession(session: AuthSession): void {
  writeStorage(STORAGE_KEY, session);
}

export function clearSession(): void {
  removeStorage(STORAGE_KEY);
}
