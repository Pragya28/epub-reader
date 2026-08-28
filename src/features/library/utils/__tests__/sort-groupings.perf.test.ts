import { describe, expect, it } from "vitest";

import type {
  Grouping,
  GroupingMember,
  StoredBook,
} from "@/services/storage/storage-types";
import {
  buildGroupingsWithMeta,
  sortGroupings,
  splitByType,
} from "../sort-groupings";
import { enrichBookWithProgress } from "../derive-book-status";

/**
 * A regression guard, not a tight perf gate — mirrors
 * actions/__tests__/load-library.perf.test.ts's shape. Sprint 7 Day 6
 * confirmed use-shelves-screen.ts and use-grouping-books.ts are both
 * already memoized against real deps; this checks the underlying
 * computation those memos wrap doesn't itself scale badly, since a green
 * memoization check alone doesn't prove the pipeline is fast (see Sprint
 * 6's lesson: a passing timing guard hid a real bug because it measured
 * the wrong layer).
 *
 * Book/grouping counts here are well beyond a realistic personal library —
 * generous margin, not a realistic ceiling.
 */
const BOOK_COUNT = 2_000;
const GROUPING_COUNT = 500;
const PIPELINE_TIME_BUDGET_MS = 500;

function makeBook(i: number): StoredBook {
  return {
    id: `perf-book-${i}`,
    title: `Book ${i}`,
    author: `Author ${i % 50}`,
    language: "en",
    wordCount: 20_000,
    createdAt: i,
    fileHash: `perf-hash-${i}`,
  };
}

function makeGrouping(i: number): Grouping {
  const type = i % 2 === 0 ? "series" : "collection";
  return {
    id: `grouping-${i}`,
    type,
    name: `${type === "series" ? "Series" : "Collection"} ${i}`,
    createdAt: i,
    updatedAt: i,
  };
}

describe("Shelves aggregation performance at scale", () => {
  it(`derives merged/series/collections for ${GROUPING_COUNT} groupings across ${BOOK_COUNT} books within budget`, () => {
    const books = Array.from({ length: BOOK_COUNT }, (_, i) => makeBook(i));
    const booksById = new Map(books.map((book) => [book.id, book]));
    const groupings = Array.from({ length: GROUPING_COUNT }, (_, i) =>
      makeGrouping(i),
    );

    // Spread the library's books evenly across every grouping — same
    // many-groupings-share-the-library shape a real Shelves tab has.
    const membersByGrouping = new Map<string, GroupingMember[]>(
      groupings.map((grouping, gi) => [
        grouping.id,
        Array.from({ length: BOOK_COUNT / GROUPING_COUNT }, (_, bi) => ({
          groupingId: grouping.id,
          bookId:
            books[(gi * (BOOK_COUNT / GROUPING_COUNT) + bi) % BOOK_COUNT].id,
          order: bi,
        })),
      ]),
    );

    const start = performance.now();
    const withMeta = buildGroupingsWithMeta(
      groupings,
      membersByGrouping,
      booksById,
    );
    const sorted = sortGroupings(withMeta, "alphabetical");
    const { merged, series, collections } = splitByType(sorted);
    const elapsedMs = performance.now() - start;

    expect(merged).toHaveLength(GROUPING_COUNT);
    expect(series.length + collections.length).toBe(GROUPING_COUNT);
    expect(elapsedMs).toBeLessThan(PIPELINE_TIME_BUDGET_MS);
  });

  it(`orders a single grouping's ${BOOK_COUNT} members within budget`, () => {
    const books = Array.from({ length: BOOK_COUNT }, (_, i) => makeBook(i));
    const members: GroupingMember[] = books.map((book, i) => ({
      groupingId: "grouping-0",
      bookId: book.id,
      order: BOOK_COUNT - i, // reverse, so sorting is real work
    }));
    const orderById = new Map(members.map((m) => [m.bookId, m.order]));

    const start = performance.now();
    const enriched = books.map(enrichBookWithProgress);
    const inGrouping = enriched.filter((book) => orderById.has(book.id));
    const orderedBooks = [...inGrouping].sort(
      (a, b) =>
        (orderById.get(a.id) ?? Infinity) - (orderById.get(b.id) ?? Infinity) ||
        a.title.localeCompare(b.title),
    );
    const elapsedMs = performance.now() - start;

    expect(orderedBooks).toHaveLength(BOOK_COUNT);
    expect(orderedBooks[0].id).toBe(books[BOOK_COUNT - 1].id);
    expect(elapsedMs).toBeLessThan(PIPELINE_TIME_BUDGET_MS);
  });
});
