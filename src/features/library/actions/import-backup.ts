import { readArchive } from "@/services/backup/backup-archive";
import type {
  BackupData,
  PreferencesSnapshot,
} from "@/services/backup/backup-types";
import {
  getBookByFileHash,
  saveImportedBook,
  updateBookManualStatus,
  updateBookProgress,
} from "@/services/storage/book-repository";
import {
  ensureSeriesGroupings,
  getMembersForGrouping,
  listGroupings,
} from "@/services/storage/groupings";
import type {
  GroupingMember,
  StoredBook,
} from "@/services/storage/storage-types";
import { preferencesStore } from "@/features/preferences/store/preferences-store";
import { createId } from "@/utils/create-id";
import { logger as rootLogger } from "@/shared/logger/logger";
import { addBookToCollection, createCollection } from "./collections";

const logger = rootLogger.child("import-backup");

const PREFERENCES_KEY = "librune-preferences";

export interface ProgressConflict {
  localId: string;
  title: string;
  localChapter: number;
  localTotal: number;
  backupChapter: number;
  backupTotal: number;
}

export type ConflictResolution = "keep" | "take-backup";

export interface ApplyBackupSummary {
  restored: number;
  skipped: number;
  conflictsResolved: number;
  failed: number;
}

export interface ReadBackupResult {
  data: BackupData;
  conflicts: ProgressConflict[];
}

function chapterOf(book: Pick<StoredBook, "progress">): number {
  return book.progress?.chapterIndex ?? 0;
}

function totalOf(book: StoredBook): number {
  return book.progress?.totalChapters ?? book.chapterCount ?? 0;
}

async function detectConflicts(data: BackupData): Promise<ProgressConflict[]> {
  const conflicts: ProgressConflict[] = [];
  for (const book of data.manifest.books) {
    const local = await getBookByFileHash(book.fileHash);
    if (!local) continue;
    if (chapterOf(local) === chapterOf(book)) continue;
    conflicts.push({
      localId: local.id,
      title: local.title,
      localChapter: chapterOf(local),
      localTotal: totalOf(local),
      backupChapter: chapterOf(book),
      backupTotal: totalOf(book),
    });
  }
  return conflicts;
}

export async function readBackup(file: Blob): Promise<ReadBackupResult> {
  const data = await readArchive(file); // throws BackupFormatError
  return { data, conflicts: await detectConflicts(data) };
}

export async function applyBackup(
  data: BackupData,
  resolutions: Map<string, ConflictResolution>,
): Promise<ApplyBackupSummary> {
  const summary: ApplyBackupSummary = {
    restored: 0,
    skipped: 0,
    conflictsResolved: 0,
    failed: 0,
  };

  const archiveToLocal = new Map<string, string>();
  const newlyRestored: Array<{ localId: string; file: Blob }> = [];

  for (const book of data.manifest.books) {
    try {
      const local = await getBookByFileHash(book.fileHash);

      if (local) {
        archiveToLocal.set(book.id, local.id);
        const differs = chapterOf(local) !== chapterOf(book);
        if (differs && resolutions.get(local.id) === "take-backup") {
          if (book.progress) await updateBookProgress(local.id, book.progress);
          if (book.manualStatus) {
            await updateBookManualStatus(local.id, book.manualStatus);
          }
          summary.conflictsResolved += 1;
        } else {
          summary.skipped += 1;
        }
        continue;
      }

      const file = data.files.get(book.id);
      if (!file) {
        summary.failed += 1;
        continue;
      }

      const localId = createId();
      const restored: StoredBook = { ...book, id: localId };
      await saveImportedBook({
        metadata: restored,
        file,
        cover: data.covers.get(book.id),
      });
      archiveToLocal.set(book.id, localId);
      newlyRestored.push({ localId, file });
      summary.restored += 1;
    } catch (error) {
      logger.error(`failed to restore book ${book.id}`, error);
      summary.failed += 1;
    }
  }

  await restoreCollections(data, archiveToLocal);

  try {
    await ensureSeriesGroupings([...archiveToLocal.values()]);
  } catch (error) {
    logger.error("series backfill after restore failed", error);
  }

  applyPreferences(data.manifest.preferences);

  // Background, fire-and-forget — mirrors importBook. A failed index build
  // never fails the restore; the lazy backfill retries on next search.
  for (const { localId, file } of newlyRestored) {
    void import("@/services/search/search-service")
      .then(({ buildIndex }) => buildIndex(localId, file))
      .catch((error: unknown) => {
        logger.error(`failed to index restored book ${localId}`, error);
      });
  }

  return summary;
}

async function restoreCollections(
  data: BackupData,
  archiveToLocal: Map<string, string>,
): Promise<void> {
  const collections = data.manifest.groupings.filter(
    (g) => g.type === "collection",
  );
  if (collections.length === 0) return;

  const byName = new Map(
    (await listGroupings("collection")).map((g) => [
      g.name.toLowerCase(),
      g.id,
    ]),
  );

  const membersByGrouping = new Map<string, GroupingMember[]>();
  for (const member of data.manifest.groupingMembers) {
    const list = membersByGrouping.get(member.groupingId) ?? [];
    list.push(member);
    membersByGrouping.set(member.groupingId, list);
  }

  for (const collection of collections) {
    try {
      let localGroupingId = byName.get(collection.name.toLowerCase());
      if (!localGroupingId) {
        localGroupingId = await createCollection(collection.name);
        byName.set(collection.name.toLowerCase(), localGroupingId);
      }

      const already = new Set(
        (await getMembersForGrouping(localGroupingId)).map((m) => m.bookId),
      );

      for (const member of membersByGrouping.get(collection.id) ?? []) {
        const localBookId = await resolveLocalBookId(
          member.bookId,
          archiveToLocal,
          data,
        );
        if (!localBookId || already.has(localBookId)) continue;
        await addBookToCollection(localGroupingId, localBookId);
        already.add(localBookId);
      }
    } catch (error) {
      logger.error(`failed to restore collection "${collection.name}"`, error);
    }
  }
}

async function resolveLocalBookId(
  archiveBookId: string,
  archiveToLocal: Map<string, string>,
  data: BackupData,
): Promise<string | undefined> {
  const mapped = archiveToLocal.get(archiveBookId);
  if (mapped) return mapped;
  const archiveBook = data.manifest.books.find((b) => b.id === archiveBookId);
  if (!archiveBook) return undefined;
  const local = await getBookByFileHash(archiveBook.fileHash);
  return local?.id;
}

/** Apply the snapshot only on a genuinely fresh device — no persisted
 * preferences at all. Otherwise the device's own preferences win, in full
 * (spec decision 5). Best-effort: logged, never toasted. */
function applyPreferences(snapshot: PreferencesSnapshot): void {
  try {
    if (localStorage.getItem(PREFERENCES_KEY) !== null) return;
  } catch {
    return;
  }
  try {
    const s = preferencesStore.getState();
    s.setTheme(snapshot.theme);
    s.setApplyThemeToReader(snapshot.applyThemeToReader);
    s.setReaderFont(snapshot.readerFont);
    s.setReaderTheme(snapshot.readerTheme);
    s.setFontScale(snapshot.fontScale);
    s.setLineHeight(snapshot.lineHeight);
    s.setMargins(snapshot.margins);
    s.setParagraphSpacing(snapshot.paragraphSpacing);
    s.setKeepScreenAwake(snapshot.keepScreenAwake);
    s.setKeepScreenAwakeMinutes(snapshot.keepScreenAwakeMinutes);
  } catch (error) {
    logger.error("failed to apply preferences from backup", error);
  }
}
