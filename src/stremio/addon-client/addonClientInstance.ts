import { AddonClient } from "./AddonClient";

// Shared instance — AddonClient is stateless per call, this just avoids
// every screen re-declaring `new AddonClient()` with its own defaults.
export const addonClient = new AddonClient();
