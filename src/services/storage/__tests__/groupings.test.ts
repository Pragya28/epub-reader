import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMember,
  deleteGrouping,
  deleteMembersForBook,
  ensureSeriesGroupings,
  getGrouping,
  getMembersForBook,
  getMembersForGrouping,
  getNextInSeries,
  hasSeriesMembership,
  isCollection,
  listGroupings,
  putGrouping,
  removeMember,
  upsertSeriesMembership,
} from "../groupings";
import { EpubParser } from "@/services/epub/epub-parser";
import * as bookRepository from "@/services/storage/book-repository";
import {
  getAllBooks,
  getBook,
  saveBookMetadata,
} from "@/services/storage/book-repository";
import { importBook } from "@/features/library/actions/import-book";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";
import { db } from "../db";
import type { Grouping } from "../storage-types";

describe("groupings", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
  });

  it("puts and gets a grouping", async () => {
    const grouping: Grouping = {
      id: "g1",
      type: "collection",
      name: "Favorites",
      createdAt: 1,
      updatedAt: 1,
    };

    await putGrouping(grouping);

    expect(await getGrouping("g1")).toEqual(grouping);
  });

  it("lists groupings filtered by type", async () => {
    await putGrouping({
      id: "g1",
      type: "collection",
      name: "Favorites",
      createdAt: 1,
      updatedAt: 1,
    });
    await putGrouping({
      id: "g2",
      type: "series",
      name: "Foundation",
      createdAt: 2,
      updatedAt: 2,
    });

    const collections = await listGroupings("collection");
    expect(collections).toHaveLength(1);
    expect(collections[0].id).toBe("g1");

    expect(await listGroupings()).toHaveLength(2);
  });

  it("deletes a grouping", async () => {
    await putGrouping({
      id: "g1",
      type: "collection",
      name: "Favorites",
      createdAt: 1,
      updatedAt: 1,
    });

    await deleteGrouping("g1");

    expect(await getGrouping("g1")).toBeUndefined();
  });

  it("adds and reads membership from both sides", async () => {
    await addMember("g1", "book-1", 2);

    expect(await getMembersForBook("book-1")).toEqual([
      { groupingId: "g1", bookId: "book-1", order: 2 },
    ]);
    expect(await getMembersForGrouping("g1")).toEqual([
      { groupingId: "g1", bookId: "book-1", order: 2 },
    ]);
  });

  it("removes a specific membership without touching others", async () => {
    await addMember("g1", "book-1", null);
    await addMember("g1", "book-2", null);

    await removeMember("g1", "book-1");

    const remaining = await getMembersForGrouping("g1");
    expect(remaining).toEqual([
      { groupingId: "g1", bookId: "book-2", order: null },
    ]);
  });

  it("getNextInSeries returns the book with the next-higher order", async () => {
    await putGrouping({
      id: "series-1",
      type: "series",
      name: "The Trilogy",
      createdAt: 1,
      updatedAt: 1,
    });
    await addMember("series-1", "book-1", 1);
    await addMember("series-1", "book-2", 2);
    await addMember("series-1", "book-3", 3);
    await saveBookMetadata({
      id: "book-2",
      title: "Book Two",
      author: "Author",
      language: "en",
      createdAt: 1,
      fileHash: "hash-2",
    });

    const next = await getNextInSeries("series-1", 1);

    expect(next?.id).toBe("book-2");
  });

  it("getNextInSeries returns undefined for the last book in the series", async () => {
    await putGrouping({
      id: "series-1",
      type: "series",
      name: "The Trilogy",
      createdAt: 1,
      updatedAt: 1,
    });
    await addMember("series-1", "book-3", 3);

    expect(await getNextInSeries("series-1", 3)).toBeUndefined();
  });

  it("isCollection is true only for collection-type groupings", () => {
    expect(
      isCollection({
        id: "g1",
        type: "collection",
        name: "x",
        createdAt: 1,
        updatedAt: 1,
      }),
    ).toBe(true);
    expect(
      isCollection({
        id: "g2",
        type: "series",
        name: "x",
        createdAt: 1,
        updatedAt: 1,
      }),
    ).toBe(false);
  });

  describe("upsertSeriesMembership", () => {
    it("creates a new series grouping, returns its id, and stamps updatedAt", async () => {
      const groupingId = await upsertSeriesMembership(
        "book-1",
        "Foundation Series",
        1,
      );

      const series = await listGroupings("series");
      expect(series).toHaveLength(1);
      expect(series[0].id).toBe(groupingId);
      expect(series[0].name).toBe("Foundation Series");
      expect(series[0].updatedAt).toBeTypeOf("number");

      const members = await getMembersForBook("book-1");
      expect(members).toEqual([{ groupingId, bookId: "book-1", order: 1 }]);
    });

    it("stamps the book's seriesGroupingId when the book row already exists", async () => {
      await db.books.put({
        id: "book-1",
        title: "Foundation",
        createdAt: 1,
        fileHash: "h1",
      });

      const groupingId = await upsertSeriesMembership(
        "book-1",
        "Foundation Series",
        1,
      );

      const book = await getBook("book-1");
      expect(book?.seriesGroupingId).toBe(groupingId);
    });

    it("reuses an existing series matched case-insensitively", async () => {
      const first = await upsertSeriesMembership(
        "book-1",
        "Foundation Series",
        1,
      );
      const second = await upsertSeriesMembership(
        "book-2",
        "foundation series",
        2,
      );

      expect(second).toBe(first);
      const series = await listGroupings("series");
      expect(series).toHaveLength(1);

      const members = await getMembersForGrouping(series[0].id);
      expect(members).toHaveLength(2);
    });

    it("hasSeriesMembership reflects whether a book has a series row", async () => {
      expect(await hasSeriesMembership("book-1")).toBe(false);

      await upsertSeriesMembership("book-1", "Foundation Series", 1);

      expect(await hasSeriesMembership("book-1")).toBe(true);
    });
  });

  describe("deleteMembersForBook", () => {
    it("removes all of a book's memberships", async () => {
      await addMember("g1", "book-1", null);
      await addMember("g2", "book-1", null);
      await addMember("g1", "book-2", null);

      await deleteMembersForBook("book-1");

      expect(await getMembersForBook("book-1")).toHaveLength(0);
      expect(await getMembersForGrouping("g1")).toEqual([
        { groupingId: "g1", bookId: "book-2", order: null },
      ]);
    });

    it("deletes an emptied series grouping but keeps an emptied collection", async () => {
      await putGrouping({
        id: "series-1",
        type: "series",
        name: "Foundation Series",
        createdAt: 1,
        updatedAt: 1,
      });
      await putGrouping({
        id: "collection-1",
        type: "collection",
        name: "Favorites",
        createdAt: 2,
        updatedAt: 2,
      });
      await addMember("series-1", "book-1", 1);
      await addMember("collection-1", "book-1", null);

      await deleteMembersForBook("book-1");

      expect(await getGrouping("series-1")).toBeUndefined();
      expect(await getGrouping("collection-1")).toBeDefined();
    });
  });

  describe("ensureSeriesGroupings", () => {
    const mockSeriesMetadata = () => {
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
    };

    it("derives series membership from a book's cached seriesName without reading the file", async () => {
      mockSeriesMetadata();
      const file = await loadFixture("valid-book.epub");
      await importBook(file);
      const [book] = await getAllBooks();

      // Simulate a lost/pre-existing membership row while the cached
      // seriesName survives on StoredBook (import already wrote it).
      const [member] = await getMembersForBook(book.id);
      await removeMember(member.groupingId, book.id);
      expect(await getMembersForBook(book.id)).toHaveLength(0);

      const getBookFileSpy = vi.spyOn(bookRepository, "getBookFile");

      await ensureSeriesGroupings([book.id]);

      expect(getBookFileSpy).not.toHaveBeenCalled();
      const members = await getMembersForBook(book.id);
      expect(members).toHaveLength(1);
      const grouping = await getGrouping(members[0].groupingId);
      expect(grouping?.name).toBe("Dune Saga");
    });

    it("skips books that already have a series membership", async () => {
      mockSeriesMetadata();
      const file = await loadFixture("valid-book.epub");
      await importBook(file);
      const [book] = await getAllBooks();

      const before = await getMembersForBook(book.id);

      await ensureSeriesGroupings([book.id]);

      expect(await getMembersForBook(book.id)).toEqual(before);
    });

    it("does nothing for a book with no cached seriesName", async () => {
      const file = await loadFixture("valid-book.epub");
      await importBook(file);
      const [book] = await getAllBooks();

      await ensureSeriesGroupings([book.id]);

      expect(await getMembersForBook(book.id)).toHaveLength(0);
    });
  });
});
