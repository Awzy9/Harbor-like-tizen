import { getTizenGlobal, isTizen } from "./env";

export interface DeviceInfo {
  isTizen: boolean;
  platformVersion?: string;
}

export function getDeviceInfo(): DeviceInfo {
  const tizen = getTizenGlobal();
  if (!tizen) {
    return { isTizen: false };
  }

  try {
    const caps = tizen.systeminfo.getCapabilities();
    return { isTizen: true, platformVersion: caps.platformVersion };
  } catch (err) {
    console.warn("[device] getCapabilities() failed", err);
    return { isTizen: isTizen() };
  }
}
