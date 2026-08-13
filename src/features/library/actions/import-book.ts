import { EpubParser } from "@/services/epub/epub-parser";
import { buildIndex } from "@/services/search/search-service";
import { saveImportedBook } from "@/services/storage/book-repository";
import { createBookId } from "@/utils/create-book-id";
import { hashFile } from "@/utils/hash";
import { logger as rootLogger } from "@/shared/logger/logger";
import { libraryStore } from "../store/library-store";
import type { StoredBook } from "@/services/storage/storage-types";

const logger = rootLogger.child("import-book");

export async function importBook(file: File) {
  const store = libraryStore.getState();
  const parser = new EpubParser();

  // Import failures surface via the caller's toast (use-import-book-fab.ts),
  // not the library-level `error` field — that's reserved for loadLibrary()
  // failures, which blank the whole grid; a failed import shouldn't.
  try {
    store.setLoading(true);

    // 2. Parse book
    const parsed = await parser.parseLibraryBook(file);

    const {
      metadata,
      cover,
      chapterCount,
      wordCount,
      chapterWordCounts,
      readingTimeMinutes,
    } = parsed;

    // 3. Generate app ID
    const bookId = createBookId();

    // 4. Hash file for duplicate detection
    const fileHash = await hashFile(file);

    // 5. Check duplicates
    const existingBook = store.books.find((book) => book.fileHash === fileHash);

    if (existingBook) {
      throw new Error("Book already imported");
    }

    const createdAt = Date.now();

    const book: StoredBook = {
      id: bookId,
      title: metadata.title,
      author: metadata.author,
      language: metadata.language,
      description: metadata.description,
      chapterCount,
      wordCount,
      chapterWordCounts,
      readingTimeMinutes,
      createdAt,
      fileHash,
      progress: {
        chapterIndex: 0,
        totalChapters: chapterCount,
        scrollFraction: 0,
        anchorPath: null,
        atDocumentEnd: false,
        percent: 0,
        updatedAt: createdAt,
      },
    };

    // 6. Persist book
    await saveImportedBook({
      metadata: book,
      file,
      cover,
    });

    // 7. Update store reactively
    store.addBook(book);

    // The index is the largest write of the import and the likeliest to hit
    // a storage quota, and it runs *after* the book itself is already
    // persisted — so a failure here must not fail an otherwise-good import.
    // ensureIndexesForBooks() rebuilds a missing index on the next search,
    // so the book is searchable again once space frees up.
    try {
      await buildIndex(bookId, file);
    } catch (error) {
      logger.error("failed to build search index for imported book", error);
    }

    return {
      id: bookId,
      metadata: metadata,
    };
  } finally {
    store.setLoading(false);
  }
}
