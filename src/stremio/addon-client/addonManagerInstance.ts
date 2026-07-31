import { AddonManager } from "./AddonManager";

// One shared instance so installing/removing an add-on from the Add-ons
// screen is immediately visible to anything else that lists add-ons
// (Home's catalog rows, Search) without needing a global store.
export const addonManager = new AddonManager();
