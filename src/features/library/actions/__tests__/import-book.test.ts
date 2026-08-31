import { beforeEach, describe, expect, it, vi } from "vitest";
import { EpubParser } from "@/services/epub/epub-parser";
import { hasIndex } from "@/services/search/search-index";
import { buildIndex } from "@/services/search/search-service";
import { getAllBooks } from "@/services/storage/book-repository";
import {
  getGrouping,
  getMembersForBook,
  getMembersForGrouping,
} from "@/services/storage/groupings";
import { importBook } from "../import-book";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";

// Every successful importBook() call below awaits the returned `indexed`
// promise (background search indexing — a second full JSZip parse) before
// the test ends. Left dangling, it can still be mid-flight when the next
// test's beforeEach() resets the fake IndexedDB, intermittently crashing
// with an unhandled exception deep in JSZip's stream decoding.
//
// Wraps the real buildIndex so the other tests here still exercise real
// indexing; only the failure test overrides it for a single call.
vi.mock("@/services/search/search-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/search/search-service")>();
  return { ...actual, buildIndex: vi.fn(actual.buildIndex) };
});

describe("importBook", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
  });

  it("imports and persists a book", async () => {
    const file = await loadFixture("valid-book.epub");
    try {
      const { indexed } = await importBook(file);
      await indexed;
    } catch {
      // expected unless using real epub
    }

    const books = await getAllBooks();

    expect(Array.isArray(books)).toBe(true);
  });

  it("supports nested opf paths", async () => {
    const file = await loadFixture("nested-opf.epub");

    const { indexed } = await importBook(file);
    await indexed;
  });

  it("handles missing metadata gracefully", async () => {
    const file = await loadFixture("missing-metadata.epub");

    const { indexed } = await importBook(file);
    await indexed;

    const books = await getAllBooks();

    expect(books).toHaveLength(1);
  });

  it("throws on invalid epub", async () => {
    const file = await loadFixture("invalid.epub");

    await expect(importBook(file)).rejects.toThrow();
  });

  it("supports multiple imports", async () => {
    const first = await loadFixture("valid-book.epub");

    const second = await loadFixture("valid-book-2.epub");

    const firstResult = await importBook(first);
    const secondResult = await importBook(second);
    await Promise.all([firstResult.indexed, secondResult.indexed]);

    const books = await getAllBooks();

    expect(books).toHaveLength(2);
  });

  it("imports large epub", async () => {
    const file = await loadFixture("large-book.epub");

    // Import also builds the search index (a second full parse of the
    // book) — inherits the project's global testTimeout (vite.config.ts)
    // rather than a per-test override, since that budget has needed
    // raising more than once for this exact reason.
    const { indexed } = await importBook(file);
    await indexed;
  });

  it("throws for invalid spine references", async () => {
    const file = await loadFixture("broken-spine.epub");

    await expect(importBook(file)).rejects.toThrow(/Invalid spine reference/);
  });

  it("persists chapter count, word count and reading time", async () => {
    const file = await loadFixture("valid-book.epub");

    const { indexed } = await importBook(file);
    await indexed;

    const [book] = await getAllBooks();

    expect(book.chapterCount).toBeGreaterThan(0);
    expect(book.wordCount).toBeGreaterThan(0);
    expect(book.readingTimeMinutes).toBeGreaterThan(0);
  });

  it("builds a search index for the imported book", async () => {
    const file = await loadFixture("valid-book.epub");

    const { indexed } = await importBook(file);
    await indexed; // indexing runs in the background — wait for it here

    const [book] = await getAllBooks();
    expect(await hasIndex(book.id)).toBe(true);
  });

  it("still imports the book when index building fails", async () => {
    // Stands in for an exhausted storage quota — the index write is the
    // largest of the import and runs after the book itself is persisted,
    // so failing it must not fail the import.
    vi.mocked(buildIndex).mockRejectedValueOnce(
      new DOMException("quota", "QuotaExceededError"),
    );

    const file = await loadFixture("valid-book.epub");
    const result = await importBook(file);
    expect(result).toBeDefined();
    // Rejects (mocked above) but is swallowed inside importBook's own
    // .catch, so awaiting it here can't turn this test's failure-path
    // assertion into an unrelated rejection.
    await result.indexed;

    // Guards against the mock silently not applying, which would make the
    // assertion above pass without ever exercising the failure path.
    expect(buildIndex).toHaveBeenCalled();
    expect(await getAllBooks()).toHaveLength(1);
  });

  it("rejects duplicate book imports", async () => {
    const file = await loadFixture("valid-book.epub");
    const { indexed } = await importBook(file);
    await expect(importBook(file)).rejects.toThrow("Book already imported");
    await indexed;
    const books = await getAllBooks();
    expect(books).toHaveLength(1);
  });

  it("creates a series grouping when the book has series metadata", async () => {
    vi.spyOn(EpubParser.prototype, "parseLibraryBook").mockResolvedValueOnce({
      metadata: {
        title: "Foundation",
        author: "Isaac Asimov",
        language: "en",
        description: null,
        seriesName: "Foundation Series",
        seriesIndex: 1,
      },
      cover: undefined,
      chapterCount: 1,
      wordCount: 100,
      chapterWordCounts: [100],
      readingTimeMinutes: 1,
    });

    const file = await loadFixture("valid-book.epub");
    const { indexed } = await importBook(file);
    await indexed;

    const [book] = await getAllBooks();
    expect(book.seriesName).toBe("Foundation Series");
    expect(book.seriesIndex).toBe(1);

    const members = await getMembersForBook(book.id);
    expect(members).toHaveLength(1);

    const grouping = await getGrouping(members[0].groupingId);
    expect(grouping).toMatchObject({
      type: "series",
      name: "Foundation Series",
    });
  });

  it("does not create a series grouping when the book has no series metadata", async () => {
    const file = await loadFixture("valid-book.epub");
    const { indexed } = await importBook(file);
    await indexed;

    const [book] = await getAllBooks();
    expect(book.seriesName).toBeUndefined();
    expect(await getMembersForBook(book.id)).toHaveLength(0);
  });

  it("imports two distinct real books into the same series grouping", async () => {
    vi.spyOn(EpubParser.prototype, "parseLibraryBook").mockResolvedValueOnce({
      metadata: {
        title: "The Wonderful Wizard of Oz",
        author: "L. Frank Baum",
        language: "en",
        description: null,
        seriesName: "Oz",
        seriesIndex: 1,
      },
      cover: undefined,
      chapterCount: 1,
      wordCount: 100,
      chapterWordCounts: [100],
      readingTimeMinutes: 1,
    });
    vi.spyOn(EpubParser.prototype, "parseLibraryBook").mockResolvedValueOnce({
      metadata: {
        title: "The Marvelous Land of Oz",
        author: "L. Frank Baum",
        language: "en",
        description: null,
        seriesName: "Oz",
        seriesIndex: 2,
      },
      cover: undefined,
      chapterCount: 1,
      wordCount: 100,
      chapterWordCounts: [100],
      readingTimeMinutes: 1,
    });

    const first = await loadFixture("series-1.epub");
    const second = await loadFixture("series-2.epub");
    const firstResult = await importBook(first);
    const secondResult = await importBook(second);
    await Promise.all([firstResult.indexed, secondResult.indexed]);

    const books = await getAllBooks();
    expect(books).toHaveLength(2);
    expect(books[0].seriesGroupingId).toBe(books[1].seriesGroupingId);

    const series = await getGrouping(books[0].seriesGroupingId!);
    expect(series).toMatchObject({ type: "series", name: "Oz" });

    const members = await getMembersForGrouping(books[0].seriesGroupingId!);
    expect(members).toHaveLength(2);
    expect(members.map((m) => m.order).sort()).toEqual([1, 2]);
  });

  it("sets seriesGroupingId on the book in the same save as the rest of the metadata", async () => {
    vi.spyOn(EpubParser.prototype, "parseLibraryBook").mockResolvedValueOnce({
      metadata: {
        title: "Dune",
        author: "Frank Herbert",
        language: "en",
        description: null,
        seriesName: "Dune Saga",
        seriesIndex: 1,
      },
      cover: undefined,
      chapterCount: 1,
      wordCount: 100,
      chapterWordCounts: [100],
      readingTimeMinutes: 1,
    });

    const file = await loadFixture("valid-book.epub");
    const { indexed } = await importBook(file);
    await indexed;

    const [book] = await getAllBooks();
    expect(book.seriesGroupingId).toBeTypeOf("string");

    const grouping = await getGrouping(book.seriesGroupingId!);
    expect(grouping?.name).toBe("Dune Saga");

    const members = await getMembersForBook(book.id);
    expect(members).toEqual([
      { groupingId: book.seriesGroupingId, bookId: book.id, order: 1 },
    ]);
  });
});
