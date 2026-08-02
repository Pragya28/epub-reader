import { db } from "./db";
import { deleteOpfsFile, readOpfsFile, writeOpfsFile } from "./opfs-files";
import type { StoredBookFile } from "./storage-types";

/**
 * Storage abstraction for EPUB file blobs: OPFS is the primary store, with
 * the original `bookFiles` IndexedDB table as a fallback for browsers
 * without a writable OPFS (see opfs-files.ts) and as the source for
 * books imported before OPFS support existed. Books already in IndexedDB
 * are migrated to OPFS lazily, on next read, rather than via a batch
 * migration pass.
 */

export async function saveBookFile(bookId: string, file: Blob): Promise<void> {
  const wroteToOpfs = await writeOpfsFile(bookId, file);

  if (wroteToOpfs) {
    await db.bookFiles.delete(bookId);
    return;
  }

  await db.bookFiles.put({ bookId, file });
}

export async function getBookFile(
  bookId: string,
): Promise<StoredBookFile | undefined> {
  const opfsFile = await readOpfsFile(bookId);

  if (opfsFile) {
    return { bookId, file: opfsFile };
  }

  const legacy = await db.bookFiles.get(bookId);

  if (!legacy) {
    return undefined;
  }

  if (await writeOpfsFile(bookId, legacy.file)) {
    await db.bookFiles.delete(bookId);
  }

  return legacy;
}

export async function deleteBookFile(bookId: string): Promise<void> {
  await Promise.all([deleteOpfsFile(bookId), db.bookFiles.delete(bookId)]);
}
