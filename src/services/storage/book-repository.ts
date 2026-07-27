import { cacheCoverUrl, getCachedCoverUrl } from "./cover-cache";
import { db } from "./db";
import type { ReadingProgress, StoredBook } from "./storage-types";

export async function saveBookMetadata(book: StoredBook) {
  await db.books.put(book);
}

export async function saveBookFile(bookId: string, file: Blob) {
  await db.bookFiles.put({
    bookId,
    file,
  });
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

export async function getBook(bookId: string) {
  return db.books.get(bookId);
}

export async function getBookFile(bookId: string) {
  return db.bookFiles.get(bookId);
}

export async function getBookWithFile(bookId: string) {
  const [book, bookFile] = await Promise.all([
    db.books.get(bookId),
    db.bookFiles.get(bookId),
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
  await db.transaction(
    "rw",
    db.books,
    db.bookFiles,
    db.bookCovers,
    async () => {
      await db.books.put(metadata);

      await db.bookFiles.put({
        bookId: metadata.id,
        file,
      });

      if (cover) {
        await db.bookCovers.put({
          bookId: metadata.id,
          cover,
        });
      }
    },
  );
}

export async function updateBookProgress(
  bookId: string,
  progress: ReadingProgress,
): Promise<void> {
  await db.books.update(bookId, { progress, manualStatus: undefined });
}

/**
 * Books that have reading progress, most-recently-read first. Used to
 * pick the "continue reading" book without pulling the whole library.
 */
export async function getBooksSortedByLastRead(): Promise<StoredBook[]> {
  return db.books
    .orderBy("progress.updatedAt")
    .reverse()
    .filter((book) => !!book.progress)
    .toArray();
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
