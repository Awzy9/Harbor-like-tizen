// Minimal ambient types for the subset of the Tizen Web Device API this app
// uses. Not a full port of the Tizen IDL — extend as new APIs are needed.
// Reference: https://developer.samsung.com/smarttv/develop/api-references

export {};

declare global {
  interface TizenInputDeviceKey {
    name: string;
    code: number;
  }

  interface TizenTvInputDeviceManager {
    registerKey(keyName: string): void;
    unregisterKey(keyName: string): void;
    getSupportedKeys(): TizenInputDeviceKey[];
  }

  interface TizenApplication {
    exit(): void;
    hide(): void;
  }

  interface TizenApplicationManager {
    getCurrentApplication(): TizenApplication;
  }

  interface TizenSystemInfoDeviceCapability {
    platformVersion?: string;
    duid?: string;
  }

  interface TizenSystemInfo {
    getCapabilities(): TizenSystemInfoDeviceCapability;
  }

  interface TizenGlobal {
    tvinputdevice: TizenTvInputDeviceManager;
    application: TizenApplicationManager;
    systeminfo: TizenSystemInfo;
  }

  // Samsung-specific (not part of the generic W3C `tizen` namespace above) —
  // only present on real Samsung TV firmware, never in Tizen Studio's
  // generic emulator or a desktop browser. Model info has no standard
  // browser equivalent, so this is read defensively (see deviceCapabilities.ts).
  interface SamsungProductInfo {
    getModel?: () => string;
    getRealModel?: () => string;
    getModelCode?: () => string;
    getFirmware?: () => string;
  }

  interface SamsungWebApis {
    productinfo?: SamsungProductInfo;
  }

  interface Window {
    tizen?: TizenGlobal;
    webapis?: SamsungWebApis;
  }
}
