import { useCallback, useEffect, useState } from "react";
import {
  estimateStorage,
  isStoragePersisted,
  requestPersistentStorage,
  type StorageEstimate,
} from "@/services/storage/storage-quota";

/** Formats a byte count as a short human string (e.g. "42 MB", "1.8 GB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

async function readStorage(): Promise<{
  estimate: StorageEstimate | null;
  persisted: boolean;
}> {
  const [estimate, persisted] = await Promise.all([
    estimateStorage(),
    isStoragePersisted(),
  ]);
  return { estimate, persisted };
}

/** Powers the Settings → Storage section: usage estimate + persistent-storage
 * status, with a re-check after the user asks the browser to persist. */
export function useStorageSettings() {
  const [state, setState] = useState<{
    estimate: StorageEstimate | null;
    persisted: boolean | null;
  }>({ estimate: null, persisted: null });

  useEffect(() => {
    let cancelled = false;
    void readStorage().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestPersist = useCallback(async () => {
    await requestPersistentStorage();
    setState(await readStorage());
  }, []);

  return { ...state, requestPersist };
}
