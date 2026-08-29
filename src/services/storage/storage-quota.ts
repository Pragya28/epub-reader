/**
 * Origin storage quota / persistence helpers. OPFS and IndexedDB share one
 * origin-scoped quota, and a browser under disk pressure can evict the whole
 * origin unless persistent storage was granted. Every call feature-detects
 * `navigator.storage` and degrades to a safe default (never throws) — same
 * "fail soft" discipline as opfs-files.ts, since Safari private mode and
 * older browsers expose only parts of the API.
 */

// ponytail: SAFETY_MARGIN is a guess — an import writes the raw blob plus a
// cover plus (in the background) a search index. Tighten only if real
// QuotaExceededErrors slip past the pre-flight check.
const SAFETY_MARGIN = 1.5;

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  /** 0–100. */
  percentUsed: number;
}

export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (!navigator.storage?.estimate) return null;

  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    if (quota === 0) return null;

    return {
      usageBytes: usage,
      quotaBytes: quota,
      percentUsed: Math.min(100, (usage / quota) * 100),
    };
  } catch {
    return null;
  }
}

/** Ask the browser to make this origin's storage non-evictable. The browser
 * decides — a `true` result means granted, `false` means denied or the API
 * is unavailable. Safe to call repeatedly. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;

  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;

  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

/** Pre-flight check before a large write. Returns `true` when the estimate
 * is unavailable — we can't gate imports on browsers that don't expose the
 * API, only on browsers that do and report themselves full. */
export async function hasRoomFor(bytes: number): Promise<boolean> {
  const estimate = await estimateStorage();
  if (!estimate) return true;

  const freeBytes = estimate.quotaBytes - estimate.usageBytes;
  return freeBytes > bytes * SAFETY_MARGIN;
}
