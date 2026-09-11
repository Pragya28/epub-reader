import { createArchive } from "@/services/backup/backup-archive";
import {
  BACKUP_VERSION,
  type BackupData,
  type PreferencesSnapshot,
} from "@/services/backup/backup-types";
import { getAllBooks, getBookCover } from "@/services/storage/book-repository";
import { getBookFile } from "@/services/storage/book-files";
import {
  getMembersForGrouping,
  listGroupings,
} from "@/services/storage/groupings";
import { preferencesStore } from "@/features/preferences/store/preferences-store";
import { logger as rootLogger } from "@/shared/logger/logger";

const logger = rootLogger.child("export-library");

function snapshotPreferences(): PreferencesSnapshot {
  const s = preferencesStore.getState();
  return {
    theme: s.theme,
    applyThemeToReader: s.applyThemeToReader,
    readerFont: s.readerFont,
    readerTheme: s.readerTheme,
    fontScale: s.fontScale,
    lineHeight: s.lineHeight,
    margins: s.margins,
    paragraphSpacing: s.paragraphSpacing,
    keepScreenAwake: s.keepScreenAwake,
    keepScreenAwakeMinutes: s.keepScreenAwakeMinutes,
  };
}

export async function exportLibrary(): Promise<Blob> {
  const books = await getAllBooks();

  const files = new Map<string, Blob>();
  const covers = new Map<string, Blob>();

  for (const book of books) {
    const stored = await getBookFile(book.id);
    if (stored) {
      files.set(book.id, stored.file);
    } else {
      /* A book with no readable file still ships in the manifest;
         readArchive treats the missing books/<id>.epub as a skip on restore. */
      logger.error(`no file for book ${book.id}; exported without its EPUB`);
    }

    const cover = await getBookCover(book.id);
    if (cover) covers.set(book.id, cover.cover);
  }

  const groupings = await listGroupings();
  const groupingMembers = (
    await Promise.all(groupings.map((g) => getMembersForGrouping(g.id)))
  ).flat();

  const data: BackupData = {
    manifest: {
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      books,
      groupings,
      groupingMembers,
      preferences: snapshotPreferences(),
    },
    files,
    covers,
  };

  return createArchive(data);
}
