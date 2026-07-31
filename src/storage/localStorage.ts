const PREFIX = "harbor-tizen:";

/** Typed localStorage wrapper. Tizen TVs implement Web Storage per spec, so
 *  no platform-specific handling is needed here — just JSON (de)serialization
 *  and a namespaced key prefix. */
export function readStorage<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch (err) {
    console.warn(`[storage] failed to read "${key}"`, err);
    return undefined;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[storage] failed to write "${key}"`, err);
  }
}

export function removeStorage(key: string): void {
  localStorage.removeItem(PREFIX + key);
}
