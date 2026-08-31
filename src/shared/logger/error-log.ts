/**
 * A small, always-on ring buffer of recent errors, persisted to
 * localStorage — the one thing Logger doesn't do on its own (it's
 * console-only, and disabled outright in production for everything below
 * ERROR). This exists purely for production debugging: a user who hits a
 * bug can copy/share this log instead of us needing console access they
 * don't have. Every function fails soft (Safari private-mode localStorage
 * writes throw) — a log write must never be the thing that breaks.
 */

const STORAGE_KEY = "librune:error-log";
const MAX_ENTRIES = 50;

export interface ErrorLogEntry {
  timestamp: number;
  scope?: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function serializeError(error: unknown): ErrorLogEntry["error"] {
  if (error === undefined) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "Unknown", message: String(error) };
}

export function recordError(entry: {
  scope?: string;
  message: string;
  error?: unknown;
}): void {
  try {
    const log = getErrorLog();
    log.push({
      timestamp: Date.now(),
      scope: entry.scope,
      message: entry.message,
      error: serializeError(entry.error),
    });
    const trimmed = log.slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage unavailable/full/blocked — nothing to do.
  }
}

export function getErrorLog(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ErrorLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearErrorLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
