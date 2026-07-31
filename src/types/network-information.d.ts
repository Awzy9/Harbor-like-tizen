// navigator.connection (the Network Information API) is implemented by
// Tizen's WebKit and Chromium but isn't part of TypeScript's DOM lib —
// it's still a draft spec absent from most browsers (notably Safari), so
// every read must go through a feature check (see deviceCapabilities.ts).

export {};

declare global {
  type EffectiveConnectionType = "slow-2g" | "2g" | "3g" | "4g";

  interface NetworkInformation extends EventTarget {
    readonly effectiveType?: EffectiveConnectionType;
    readonly downlink?: number;
    readonly rtt?: number;
    readonly saveData?: boolean;
  }

  interface Navigator {
    connection?: NetworkInformation;
  }
}
