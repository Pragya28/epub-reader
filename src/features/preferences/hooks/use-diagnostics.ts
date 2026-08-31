import { useCallback, useState } from "react";
import { getErrorLog } from "@/shared/logger/error-log";
import { notify } from "@/components/toast/toast";

function errorLogFilename(): string {
  return `librune-error-log-${new Date().toISOString().replace(/:/g, "-")}.json`;
}

/** Powers the Settings → Storage → Diagnostics row: how many errors have
 * been logged this session, and Copy/Share actions over the persistent
 * error log (shared/logger/error-log.ts) for a user to hand us when
 * something goes wrong. */
export function useDiagnostics() {
  const [errorCount] = useState(() => getErrorLog().length);

  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  const copyErrorLog = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(getErrorLog(), null, 2),
      );
      notify.success("Error log copied");
    } catch {
      notify.error("Couldn't copy the error log.");
    }
  }, []);

  const shareErrorLog = useCallback(async () => {
    const file = new File(
      [JSON.stringify(getErrorLog(), null, 2)],
      errorLogFilename(),
      { type: "application/json" },
    );

    try {
      if (!navigator.canShare?.({ files: [file] })) {
        notify.error("Sharing isn't supported here.");
        return;
      }
      await navigator.share({ files: [file] });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      notify.error("Couldn't share the error log.");
    }
  }, []);

  return { errorCount, canShare, copyErrorLog, shareErrorLog };
}
