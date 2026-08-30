import { EpubParser } from "@/services/epub/epub-parser";
import { getBookFile } from "@/services/storage/book-files";
import type {
  StoredChapterText,
  StoredSearchIndexEntry,
} from "@/services/storage/storage-types";
import { logger as rootLogger } from "@/shared/logger/logger";
import { flattenToc } from "@/features/reader/utils/flatten-toc";
import { hasIndex, putIndexEntries } from "./search-index";
import { putChapterTexts } from "./chapter-text";
import { toPlainText } from "./html-text";
import { tokenizeChapterHtml } from "./tokenize";

const logger = rootLogger.child("search-service");

/**
 * Builds and persists the full-text search index for one book. Reparses the
 * book via EpubParser.loadChapter() per spine index — the same in-memory
 * extraction path the reader engine already uses — rather than a separate
 * per-chapter storage layer (see tasks/SPRINT-06-TASKS.md Day 1 decision).
 *
 * Also caches each chapter's plain text + TOC label (Sprint 6B) — search
 * result rows previously re-fetched and re-parsed the whole EPUB just to
 * build a snippet, measured at ~94ms per row. The text is a byproduct of
 * work this function already does (loadChapter + strip-to-plain-text for
 * tokenizing), so caching it costs no extra parsing here.
 */
export async function buildIndex(bookId: string, file: Blob): Promise<void> {
  const parser = new EpubParser();
  const parsedBook = await parser.parseBook(file);
  const toc = flattenToc(parsedBook.toc, 0);

  const entries: StoredSearchIndexEntry[] = [];
  const textEntries: StoredChapterText[] = [];

  for (let chapter = 0; chapter < parsedBook.chapters.length; chapter++) {
    const parsedChapter = await parsedBook.loadChapter(chapter);
    const plainText = toPlainText(parsedChapter.content);
    const words = tokenizeChapterHtml(plainText);

    // loadChapter is the reader's render path, so it mints a blob URL for
    // every embedded picture. Indexing only reads the stripped text (blob
    // URLs are gone after toPlainText), so revoke them now rather than
    // leaking one per picture for the whole book — an illustrated title
    // would otherwise hold hundreds of live object URLs until the tab closes.
    parsedChapter.assetMap.forEach((url) => URL.revokeObjectURL(url));

    for (const word of new Set(words)) {
      entries.push({ word, bookId, chapter });
    }

    const tocEntry = toc.find(({ item }) => item.chapterIndex === chapter);
    textEntries.push({
      bookId,
      chapter,
      text: plainText,
      label: tocEntry?.item.label ?? "",
    });
  }

  if (entries.length > 0) {
    await putIndexEntries(entries);
  }

  // The text cache is a read-path optimization, not the index itself — a
  // failure here (e.g. storage quota) must not fail index building, which
  // is what makes the book searchable at all. A missing cache just means
  // result rows fall back to parsing, same as before this existed.
  try {
    if (textEntries.length > 0) {
      await putChapterTexts(textEntries);
    }
  } catch (error) {
    logger.error("failed to cache chapter text", { bookId, error });
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
      // One book that can't be indexed (corrupt file, exhausted storage
      // quota, a Dexie read error) must not take down the search that
      // triggered the backfill — the whole callback is guarded, not just
      // buildIndex, so a throw here can't reject the Promise.all. The
      // remaining books still return results, and this one is retried on
      // the next search.
      try {
        if (await hasIndex(bookId)) return;

        const stored = await getBookFile(bookId);
        if (!stored) return;

        await buildIndex(bookId, stored.file);
      } catch (error) {
        logger.error("failed to backfill search index", { bookId, error });
      }
    }),
  );
}
