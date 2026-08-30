import * as bookFiles from "./book-files";
import {
  cacheCoverUrl,
  getCachedCoverUrl,
  revokeCoverUrl,
} from "./cover-cache";
import { db } from "./db";
import type { ReadingProgress, StoredBook } from "./storage-types";

export async function saveBookMetadata(book: StoredBook) {
  await db.books.put(book);
}

export async function saveBookCover(bookId: string, cover: Blob) {
  await db.bookCovers.put({
    bookId,
    cover,
  });
}

export async function getAllBooks() {
  return db.books.orderBy("createdAt").reverse().toArray();
}

/**
 * Metadata only, no file. Reintroduced for the search screen's chapter-text
 * cache path (Sprint 6B) — a cache-hit row needs a title/author but has no
 * reason to fetch and hold the raw EPUB blob, which getBookWithFile does.
 */
export async function getBook(bookId: string) {
  return db.books.get(bookId);
}

/** Duplicate-import lookup by content hash (`&fileHash` is a unique index). */
export async function getBookByFileHash(fileHash: string) {
  return db.books.where("fileHash").equals(fileHash).first();
}

export async function getBookWithFile(bookId: string) {
  const [book, bookFile] = await Promise.all([
    db.books.get(bookId),
    bookFiles.getBookFile(bookId),
  ]);

  if (!book || !bookFile) {
    return null;
  }

  return {
    book,
    file: bookFile.file,
  };
}

export async function getBookCover(bookId: string) {
  return db.bookCovers.get(bookId);
}

interface SaveImportedBookParams {
  metadata: StoredBook;
  file: Blob;
  cover?: Blob;
}

export async function saveImportedBook({
  metadata,
  file,
  cover,
}: SaveImportedBookParams): Promise<void> {
  // File save happens first and outside the transaction below: it may go to
  // OPFS, which Dexie transactions can't span. Saving it first means a
  // failure here never leaves book metadata pointing at a missing file.
  await bookFiles.saveBookFile(metadata.id, file);

  await db.transaction("rw", db.books, db.bookCovers, async () => {
    await db.books.put(metadata);

    if (cover) {
      await db.bookCovers.put({
        bookId: metadata.id,
        cover,
      });
    }
  });
}

export async function updateBookProgress(
  bookId: string,
  progress: ReadingProgress,
): Promise<void> {
  await db.books.update(bookId, { progress, manualStatus: undefined });
}

export async function getBookCoverUrl(
  bookId: string,
): Promise<string | undefined> {
  const cached = getCachedCoverUrl(bookId);

  if (cached) {
    return cached;
  }

  const stored = await db.bookCovers.get(bookId);

  if (!stored) {
    return undefined;
  }

  return cacheCoverUrl(bookId, stored.cover);
}

export async function updateBookManualStatus(
  bookId: string,
  manualStatus: StoredBook["manualStatus"] | null,
): Promise<void> {
  await db.books.update(bookId, { manualStatus: manualStatus ?? undefined });
}

export async function resetBookProgress(bookId: string): Promise<void> {
  await db.books.update(bookId, {
    progress: undefined,
    manualStatus: undefined,
  });
}

/**
 * Removes a book entirely: EPUB file (OPFS or IndexedDB fallback), cover
 * blob, and the `books` row itself — which also carries `progress`/
 * `manualStatus`, so no separate "delete progress" step is needed.
 */
export async function deleteBook(bookId: string): Promise<void> {
  revokeCoverUrl(bookId);

  // File first and outside the transaction — it may live in OPFS, which a
  // Dexie transaction can't span (mirrors saveImportedBook). Then the cover
  // and the `books` row atomically, so a mid-delete failure can never leave
  // the row without its cover or the reverse. If the file delete throws, the
  // row survives untouched and the delete is safely retryable.
  await bookFiles.deleteBookFile(bookId);

  await db.transaction("rw", db.books, db.bookCovers, async () => {
    await db.bookCovers.delete(bookId);
    await db.books.delete(bookId);
  });
}
