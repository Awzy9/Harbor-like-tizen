import { readStorage, writeStorage } from "./localStorage";

export type SubtitleFontSize = "small" | "medium" | "large";

export interface SubtitlePreferences {
  /** Language of the last subtitle the user actively chose, or "off" if they turned subtitles off — applied automatically next time (spec: "Remember subtitle track"). */
  preferredLanguage: string | "off";
  fontSize: SubtitleFontSize;
  background: boolean;
  /** Milliseconds to shift cue timing by; positive = subtitles appear later. */
  delayMs: number;
}

const STORAGE_KEY = "subtitleSettings";
const FONT_SIZE_ORDER: SubtitleFontSize[] = ["small", "medium", "large"];
export const DELAY_STEP_MS = 250;
const MAX_DELAY_MS = 5000;

const DEFAULTS: SubtitlePreferences = {
  preferredLanguage: "off",
  fontSize: "medium",
  background: true,
  delayMs: 0,
};

export function getSubtitleSettings(): SubtitlePreferences {
  return { ...DEFAULTS, ...readStorage<Partial<SubtitlePreferences>>(STORAGE_KEY) };
}

function patchSubtitleSettings(patch: Partial<SubtitlePreferences>): SubtitlePreferences {
  const next = { ...getSubtitleSettings(), ...patch };
  writeStorage(STORAGE_KEY, next);
  return next;
}

export function setPreferredSubtitleLanguage(language: string | "off"): void {
  patchSubtitleSettings({ preferredLanguage: language });
}

export function setSubtitleBackground(enabled: boolean): SubtitlePreferences {
  return patchSubtitleSettings({ background: enabled });
}

export function nextSubtitleFontSize(current: SubtitleFontSize): SubtitleFontSize {
  const index = FONT_SIZE_ORDER.indexOf(current);
  return FONT_SIZE_ORDER[(index + 1) % FONT_SIZE_ORDER.length];
}

export function cycleSubtitleFontSize(): SubtitlePreferences {
  return patchSubtitleSettings({ fontSize: nextSubtitleFontSize(getSubtitleSettings().fontSize) });
}

export function adjustSubtitleDelay(deltaMs: number): SubtitlePreferences {
  const current = getSubtitleSettings().delayMs;
  const clamped = Math.max(-MAX_DELAY_MS, Math.min(MAX_DELAY_MS, current + deltaMs));
  return patchSubtitleSettings({ delayMs: clamped });
}

export function fontSizeRem(size: SubtitleFontSize): number {
  return { small: 1.2, medium: 1.6, large: 2.2 }[size];
}
