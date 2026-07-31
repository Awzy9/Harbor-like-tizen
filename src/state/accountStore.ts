import { create } from "zustand";
import type { AuthSession } from "@/stremio/account/types";
import { readSession } from "@/stremio/account/session";

interface AccountState {
  session: AuthSession | undefined;
  setSession: (session: AuthSession | undefined) => void;
}

// Mirrors what's in storage/session.ts for reactive reads (e.g. Settings
// showing "Signed in as ..."). The account service is the source of truth
// for persistence; callers update this store after login/logout succeed.
export const useAccountStore = create<AccountState>((set) => ({
  session: readSession(),
  setSession: (session) => set({ session }),
}));
