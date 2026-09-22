import { useCallback, useRef, useState } from "react";
import { notify } from "@/components/toast/toast";
import { BackupFormatError } from "@/services/backup/backup-types";
import type { BackupData } from "@/services/backup/backup-types";
import { downloadBlob } from "@/utils/download-blob";
import { timestampedFilename } from "@/utils/timestamped-filename";
import { logger as rootLogger } from "@/shared/logger/logger";
import { loadLibrary } from "@/features/library/actions/load-library";
import { exportLibrary } from "../actions/export-library";
import {
  applyBackup,
  readBackup,
  type ApplyBackupSummary,
  type ConflictResolution,
  type ProgressConflict,
} from "../actions/import-backup";

const logger = rootLogger.child("use-backup");

function backupFilename(): string {
  return timestampedFilename("librune-backup", "zip");
}

function summarize(s: ApplyBackupSummary): string {
  const parts = [`${s.restored} added`];
  if (s.conflictsResolved) parts.push(`${s.conflictsResolved} updated`);
  if (s.skipped) parts.push(`${s.skipped} already present`);
  if (s.failed) parts.push(`${s.failed} skipped`);
  return `Backup restored — ${parts.join(", ")}`;
}

export function useBackup() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [conflicts, setConflicts] = useState<ProgressConflict[] | null>(null);
  const pending = useRef<BackupData | null>(null);

  const exportNow = useCallback(async () => {
    setExporting(true);
    try {
      downloadBlob(await exportLibrary(), backupFilename());
      notify.success("Backup saved");
    } catch (error) {
      logger.error("export failed", error);
      notify.error("Couldn't create the backup. Try again.");
    } finally {
      setExporting(false);
    }
  }, []);

  const finish = useCallback(
    async (data: BackupData, resolutions: Map<string, ConflictResolution>) => {
      try {
        const summary = await applyBackup(data, resolutions);
        await loadLibrary();
        notify.success(summarize(summary));
      } catch (error) {
        logger.error("applyBackup failed", error);
        notify.error("Something went wrong restoring the backup.");
      } finally {
        setImporting(false);
      }
    },
    [],
  );

  const importFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const { data, conflicts: found } = await readBackup(file);
        if (found.length > 0) {
          pending.current = data;
          setConflicts(found);
          return; // wait for resolveConflicts / cancelImport
        }
        await finish(data, new Map());
      } catch (error) {
        if (error instanceof BackupFormatError) {
          notify.error(error.message);
        } else {
          logger.error("import failed", error);
          notify.error("Couldn't read that backup file.");
        }
        setImporting(false);
      }
    },
    [finish],
  );

  const resolveConflicts = useCallback(
    async (resolutions: Map<string, ConflictResolution>) => {
      const data = pending.current;
      pending.current = null;
      setConflicts(null);
      if (!data) {
        setImporting(false);
        return;
      }
      await finish(data, resolutions);
    },
    [finish],
  );

  const cancelImport = useCallback(() => {
    pending.current = null;
    setConflicts(null);
    setImporting(false);
  }, []);

  return {
    exporting,
    importing,
    conflicts,
    exportNow,
    importFile,
    resolveConflicts,
    cancelImport,
  };
}
