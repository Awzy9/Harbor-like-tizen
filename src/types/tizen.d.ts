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

  interface Window {
    tizen?: TizenGlobal;
  }
}
