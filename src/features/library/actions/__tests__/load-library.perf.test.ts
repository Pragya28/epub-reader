import { describe, expect, it } from "vitest";

import { db } from "@/services/storage/db";
import { loadLibrary } from "../load-library";
import { libraryStore } from "../../store/library-store";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";
import { enrichBookWithProgress } from "../../utils/derive-book-status";
import {
  DEFAULT_LIBRARY_FILTERS,
  filterBooksByCriteria,
  filterBooksByQuery,
} from "../../utils/filter-books";
import { sortBooks } from "../../utils/sort-books";
import type { StoredBook } from "@/services/storage/storage-types";

/**
 * A regression guard, not a tight perf gate — generous on purpose so it
 * doesn't flake on a slow CI runner. Mirrors
 * services/epub/__tests__/epub-parser.perf.test.ts, but for library scale
 * (many books) instead of book scale (many chapters): catches a
 * catastrophic regression (e.g. an accidental per-book DB round-trip
 * creeping into loadLibrary, or an O(n²) sort/filter) rather than
 * enforcing a specific budget. 2,000 books is well beyond a realistic
 * personal library (see the "don't add an index prematurely" calls
 * elsewhere in this sprint) but gives the guard real margin to catch
 * regressions before they'd ever be user-visible.
 */
const BOOK_COUNT = 2_000;
const LOAD_TIME_BUDGET_MS = 5_000;
const PIPELINE_TIME_BUDGET_MS = 500;

function makeBook(i: number): StoredBook {
  return {
    id: `perf-book-${i}`,
    title: `Book ${i}`,
    author: `Author ${i % 50}`,
    language: i % 2 === 0 ? "en" : "en-GB",
    wordCount: 20_000 + (i % 100) * 1_000,
    createdAt: i,
    fileHash: `perf-hash-${i}`,
  };
}

describe("library performance at scale", () => {
  it(
    `loads a ${BOOK_COUNT}-book library within a generous time budget`,
    async () => {
      await resetTestDb();
      resetLibraryStore();

      const books = Array.from({ length: BOOK_COUNT }, (_, i) => makeBook(i));
      await db.books.bulkPut(books);

      const start = performance.now();
      await loadLibrary();
      const elapsedMs = performance.now() - start;

      expect(libraryStore.getState().books).toHaveLength(BOOK_COUNT);
      expect(elapsedMs).toBeLessThan(LOAD_TIME_BUDGET_MS);
    },
    LOAD_TIME_BUDGET_MS + 5_000,
  );

  it(`sorts, filters and searches ${BOOK_COUNT} books within a generous time budget`, () => {
    const enriched = Array.from({ length: BOOK_COUNT }, (_, i) =>
      enrichBookWithProgress(makeBook(i)),
    );

    const start = performance.now();
    const sorted = sortBooks(enriched, "title");
    const filtered = filterBooksByCriteria(sorted, DEFAULT_LIBRARY_FILTERS);
    const searched = filterBooksByQuery(filtered, "Book 1");
    const elapsedMs = performance.now() - start;

    expect(searched.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(PIPELINE_TIME_BUDGET_MS);
  });
});
