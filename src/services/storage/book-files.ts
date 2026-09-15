import { db } from "./db";
import {
  deleteOpfsFile,
  listOpfsFileIds,
  readOpfsFile,
  writeOpfsFile,
} from "./opfs-files";
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

/** Pure existence check — unlike getBookFile, never migrates a legacy row to
 * OPFS as a side effect, so it's safe to call just to check presence. */
export async function hasBookFile(bookId: string): Promise<boolean> {
  if (await readOpfsFile(bookId)) return true;
  return (await db.bookFiles.get(bookId)) !== undefined;
}

/** Every bookId that currently has a file (OPFS or the legacy IndexedDB
 * fallback), as one upfront batched read — for callers that need to check
 * many books at once (e.g. a backup restore) instead of one round trip per
 * book via hasBookFile. */
export async function listBookFileIds(): Promise<Set<string>> {
  const [opfsIds, legacyIds] = await Promise.all([
    listOpfsFileIds(),
    db.bookFiles.toCollection().primaryKeys(),
  ]);
  return new Set([...opfsIds, ...(legacyIds as string[])]);
}

export async function deleteBookFile(bookId: string): Promise<void> {
  // deleteOpfsFile never rejects (it fails soft — see opfs-files.ts). The
  // legacy bookFiles delete below is left free to throw — callers (see
  // deleteBook's comment in book-repository.ts) rely on that to know the
  // delete didn't fully complete and is safe to retry.
  await deleteOpfsFile(bookId);
  await db.bookFiles.delete(bookId);
}
