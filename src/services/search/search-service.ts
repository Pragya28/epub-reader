import { EpubParser } from "@/services/epub/epub-parser";
import { getBookFile } from "@/services/storage/book-repository";
import type { StoredSearchIndexEntry } from "@/services/storage/storage-types";
import { logger as rootLogger } from "@/shared/logger/logger";
import { hasIndex, putIndexEntries } from "./search-index";
import { tokenizeChapterHtml } from "./tokenize";

const logger = rootLogger.child("search-service");

/**
 * Builds and persists the full-text search index for one book. Reparses the
 * book via EpubParser.loadChapter() per spine index — the same in-memory
 * extraction path the reader engine already uses — rather than a separate
 * per-chapter storage layer (see tasks/SPRINT-06-TASKS.md Day 1 decision).
 */
export async function buildIndex(bookId: string, file: Blob): Promise<void> {
  const parser = new EpubParser();
  const parsedBook = await parser.parseBook(file);

  const entries: StoredSearchIndexEntry[] = [];

  for (let chapter = 0; chapter < parsedBook.chapters.length; chapter++) {
    const parsedChapter = await parsedBook.loadChapter(chapter);
    const words = tokenizeChapterHtml(parsedChapter.content);

    for (const word of new Set(words)) {
      entries.push({ word, bookId, chapter });
    }
  }

  if (entries.length > 0) {
    await putIndexEntries(entries);
  }
}

/** Builds the index only if one doesn't already exist for this book. */
export async function ensureIndex(bookId: string, file: Blob): Promise<void> {
  if (await hasIndex(bookId)) return;
  await buildIndex(bookId, file);
}

/**
 * Backfills search indexes for books that predate this sprint's indexing
 * (or otherwise lost their index) — checked via a cheap hasIndex lookup per
 * book, with a file read + build only for the ones actually missing one.
 */
export async function ensureIndexesForBooks(bookIds: string[]): Promise<void> {
  await Promise.all(
    bookIds.map(async (bookId) => {
      if (await hasIndex(bookId)) return;

      const stored = await getBookFile(bookId);
      if (!stored) return;

      // One book that can't be indexed (corrupt file, exhausted storage
      // quota) must not take down the search that triggered the backfill —
      // the remaining books still return results, and this one is retried
      // on the next search.
      try {
        await buildIndex(bookId, stored.file);
      } catch (error) {
        logger.error("failed to backfill search index", { bookId, error });
      }
    }),
  );
}
