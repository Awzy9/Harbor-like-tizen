import { readStorage, writeStorage } from "@/storage/localStorage";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  detail?: unknown;
  timestamp: number;
}

const MAX_ENTRIES = 300;
const DEBUG_ENABLED_KEY = "debugLoggingEnabled";

/**
 * Centralized in-memory log ring buffer (docs/PROJECT_PLAN.md section 31) —
 * a single place error/network/playback events land instead of scattered
 * console.log calls, so the Diagnostics screen has something real to show
 * and clear. Always mirrors to console (so normal browser devtools debugging
 * during development is unaffected); debug-level entries are only kept/
 * mirrored when explicitly enabled from Settings, since a TV app has no
 * devtools to look at them in most of the time anyway.
 */
class Logger {
  private entries: LogEntry[] = [];
  private listeners = new Set<() => void>();

  isDebugEnabled(): boolean {
    return readStorage<boolean>(DEBUG_ENABLED_KEY) ?? false;
  }

  setDebugEnabled(enabled: boolean): void {
    writeStorage(DEBUG_ENABLED_KEY, enabled);
  }

  debug(message: string, detail?: unknown): void {
    if (!this.isDebugEnabled()) return;
    this.record("debug", message, detail);
    console.debug(`[app] ${message}`, detail ?? "");
  }

  info(message: string, detail?: unknown): void {
    this.record("info", message, detail);
    console.info(`[app] ${message}`, detail ?? "");
  }

  warn(message: string, detail?: unknown): void {
    this.record("warn", message, detail);
    console.warn(`[app] ${message}`, detail ?? "");
  }

  error(message: string, detail?: unknown): void {
    this.record("error", message, detail);
    console.error(`[app] ${message}`, detail ?? "");
  }

  getEntries(): LogEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private record(level: LogLevel, message: string, detail: unknown): void {
    this.entries.push({ level, message, detail, timestamp: Date.now() });
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
    for (const listener of this.listeners) listener();
  }
}

export const logger = new Logger();
