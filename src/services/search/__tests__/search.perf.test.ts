import { describe, expect, it, beforeAll } from "vitest";

import { db } from "@/services/storage/db";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { findChapterMatches } from "../search-content";
import type { StoredSearchIndexEntry } from "@/services/storage/storage-types";

/**
 * A regression guard, not a tight perf gate — generous on purpose so it
 * doesn't flake on a slow CI runner. Mirrors
 * features/library/actions/__tests__/load-library.perf.test.ts, but for
 * index scale: it catches a catastrophic regression (a table scan creeping
 * in where `db.searchIndex.where({ word })` used the `word` index, or a
 * per-result DB round-trip) rather than enforcing a specific budget.
 *
 * Sizing is extrapolated from the one real measurement taken while building
 * the Settings rebuild action: valid-book-2.epub (~216k words, 12 chapters)
 * produces 45,033 index rows. The 100k rows seeded here are therefore ~2
 * large books' worth, spread across many more books so per-word lookups
 * have to discriminate. It is deliberately not a full large-library
 * simulation — fake-indexeddb's bulk writes are far slower than real
 * IndexedDB (see the Day 5 note in tasks/SPRINT-06-TASKS.md), so a
 * realistic 50-book index would dominate the suite's runtime without
 * telling us anything the shape of these numbers doesn't.
 */
const BOOK_COUNT = 50;
const CHAPTERS_PER_BOOK = 8;
const WORDS_PER_CHAPTER = 250;
const VOCABULARY_SIZE = 5_000;
/** Seeded into every chapter, so it is the worst-case lookup in the store. */
const UBIQUITOUS_WORD = "librune";

const TOTAL_ROWS = BOOK_COUNT * CHAPTERS_PER_BOOK * (WORDS_PER_CHAPTER + 1);
/**
 * Measured 2026-08-11 under fake-indexeddb (slower than real IndexedDB):
 * 4.3ms worst-case ubiquitous word, 2.1ms book-scoped, 2.2ms four-word
 * query. 100ms is ~25x headroom — a regression has to be structural to
 * trip it.
 */
const QUERY_BUDGET_MS = 100;
const SEED_TIMEOUT_MS = 120_000;

function makeEntries(): StoredSearchIndexEntry[] {
  const entries: StoredSearchIndexEntry[] = [];

  for (let book = 0; book < BOOK_COUNT; book++) {
    const bookId = `perf-book-${book}`;

    for (let chapter = 0; chapter < CHAPTERS_PER_BOOK; chapter++) {
      const offset = (book * CHAPTERS_PER_BOOK + chapter) * WORDS_PER_CHAPTER;

      entries.push({ word: UBIQUITOUS_WORD, bookId, chapter });

      for (let i = 0; i < WORDS_PER_CHAPTER; i++) {
        entries.push({
          word: `word${(offset + i) % VOCABULARY_SIZE}`,
          bookId,
          chapter,
        });
      }
    }
  }

  return entries;
}

describe("search performance at index scale", () => {
  beforeAll(async () => {
    await resetTestDb();
    await db.searchIndex.bulkAdd(makeEntries());
  }, SEED_TIMEOUT_MS);

  it("seeds the expected number of index rows", async () => {
    expect(await db.searchIndex.count()).toBe(TOTAL_ROWS);
  });

  it(`looks up the most common word across ${TOTAL_ROWS} rows within a generous budget`, async () => {
    const start = performance.now();
    const matches = await findChapterMatches(UBIQUITOUS_WORD);
    const elapsedMs = performance.now() - start;

    expect(matches).toHaveLength(BOOK_COUNT * CHAPTERS_PER_BOOK);
    expect(elapsedMs).toBeLessThan(QUERY_BUDGET_MS);
  });

  it("scopes a common-word lookup to one book within a generous budget", async () => {
    const start = performance.now();
    const matches = await findChapterMatches(UBIQUITOUS_WORD, "perf-book-7");
    const elapsedMs = performance.now() - start;

    expect(matches).toHaveLength(CHAPTERS_PER_BOOK);
    expect(elapsedMs).toBeLessThan(QUERY_BUDGET_MS);
  });

  it("runs a multi-word query within a generous budget", async () => {
    const query = `word10 word20 word30 ${UBIQUITOUS_WORD}`;

    const start = performance.now();
    const matches = await findChapterMatches(query);
    const elapsedMs = performance.now() - start;

    // The ubiquitous word alone puts every chapter in the result set; the
    // rare words only reorder it, so ranking must put a multi-word hit first.
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].matchedWords.length).toBeGreaterThan(1);
    expect(elapsedMs).toBeLessThan(QUERY_BUDGET_MS);
  });
});
