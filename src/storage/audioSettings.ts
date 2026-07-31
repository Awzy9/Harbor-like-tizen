import { readStorage, writeStorage } from "./localStorage";

const STORAGE_KEY = "preferredAudioLanguage";

/** Language of the last audio track the user actively chose — applied automatically next time a stream reports more than one track (spec: "Remember audio track"). */
export function getPreferredAudioLanguage(): string | undefined {
  return readStorage<string>(STORAGE_KEY);
}

export function setPreferredAudioLanguage(language: string): void {
  writeStorage(STORAGE_KEY, language);
}
