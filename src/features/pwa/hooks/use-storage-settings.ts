import { useCallback, useEffect, useState } from "react";
import {
  estimateStorage,
  isStoragePersisted,
  requestPersistentStorage,
  type StorageEstimate,
} from "@/services/storage/storage-quota";
import { logger as rootLogger } from "@/shared/logger/logger";

const logger = rootLogger.child("use-storage-settings");

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
    try {
      await requestPersistentStorage();
      setState(await readStorage());
    } catch (error) {
      // requestPersistentStorage/estimateStorage/isStoragePersisted already
      // fail soft internally (storage-quota.ts) — denial comes back as a
      // normal `false`, never a throw. This only catches something
      // genuinely unexpected, so it logs rather than toasting: there's no
      // known real-world case for a user-facing message here.
      logger.error("failed to request persistent storage", error);
    }
  }, []);

  return { ...state, requestPersist };
}
