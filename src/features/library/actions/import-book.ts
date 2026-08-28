import { EpubParser } from "@/services/epub/epub-parser";
import { buildIndex } from "@/services/search/search-service";
import { saveImportedBook } from "@/services/storage/book-repository";
import { upsertSeriesMembership } from "@/services/storage/groupings";
import { createId } from "@/utils/create-id";
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
    const bookId = createId();

    // 4. Hash file for duplicate detection
    const fileHash = await hashFile(file);

    // 5. Check duplicates
    const existingBook = store.books.find((book) => book.fileHash === fileHash);

    if (existingBook) {
      throw new Error("Book already imported");
    }

    const createdAt = Date.now();

    // Resolved before the main save so its id can be embedded directly
    // into the book row — closes the Day 1 gap where StoredBook had no
    // seriesGroupingId to build a "View Series" link from. Its own
    // try/catch: a failure here must not fail an otherwise-good import,
    // it just leaves seriesGroupingId undefined until a future backfill
    // (ensureSeriesGroupings) fixes it — same degraded-not-broken shape
    // as the index-build try/catch below.
    let seriesGroupingId: string | undefined;
    if (metadata.seriesName) {
      try {
        seriesGroupingId = await upsertSeriesMembership(
          bookId,
          metadata.seriesName,
          metadata.seriesIndex ?? null,
        );
      } catch (error) {
        logger.error(
          "failed to upsert series grouping for imported book",
          error,
        );
      }
    }

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
      seriesName: metadata.seriesName,
      seriesIndex: metadata.seriesIndex,
      seriesGroupingId,
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

    // Indexing runs in the background, not awaited — it's the largest write
    // of the import (a second full EPUB parse) and the user doesn't need it
    // finished to start reading. Fire-and-forget rather than `void`, so a
    // caller that does care (tests, a future "still indexing" indicator)
    // can await `indexed`. A failure here must not fail an otherwise-good
    // import; ensureIndexesForBooks() rebuilds a missing index on the next
    // search, so the book is searchable again once space frees up.
    const indexed = buildIndex(bookId, file).catch((error: unknown) => {
      logger.error("failed to build search index for imported book", error);
    });

    return {
      id: bookId,
      metadata: metadata,
      indexed,
    };
  } finally {
    store.setLoading(false);
  }
}
