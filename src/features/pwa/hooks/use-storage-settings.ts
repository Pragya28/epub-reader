import { useCallback, useEffect, useState } from "react";
import {
  estimateStorage,
  isStoragePersisted,
  requestPersistentStorage,
  type StorageEstimate,
} from "@/services/storage/storage-quota";

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
