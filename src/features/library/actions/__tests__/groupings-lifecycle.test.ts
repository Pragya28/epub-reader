import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAllBooks } from "@/services/storage/book-repository";
import {
  getMembersForBook,
  getMembersForGrouping,
  listGroupings,
} from "@/services/storage/groupings";
import {
  addBookToCollection,
  createCollection,
  removeBookFromCollection,
} from "../collections";
import { deleteBook } from "../delete-book";
import { importBook } from "../import-book";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";

// These tests verify grouping mechanics (series/collection membership), not
// search content — buildIndex is mocked to a no-op so importBook doesn't
// populate the real searchIndex table with the ~11-14k rows a full EPUB
// produces. fake-indexeddb's `.where(bookId)` index queries scale terribly
// with table size (fine at a few hundred rows, 60s+ past ~10k, regardless
// of query shape — confirmed against both `.where().delete()` and
// `.where().primaryKeys()`), so a test with several deletes across a couple
// of real imports blows well past any sane timeout otherwise. Real
// IndexedDB has no such cost; this is a test-env-only tax the search-index
// tests (rebuild-search-index.test.ts) already pay deliberately because
// they're testing that exact table.
vi.mock("@/services/search/search-service", () => ({
  buildIndex: vi.fn().mockResolvedValue(undefined),
}));

/**
 * End-to-end regression across both grouping types together — the per-action
 * unit tests (import-book/delete-book/collections) each cover one mechanism
 * in isolation; this exercises series and collection membership coexisting
 * on the same book(s), the arc a real library actually builds up. Sprint 7
 * Day 7 regression pass.
 */
describe("series + collections lifecycle", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
  });

  it("lets a book belong to a series and a collection at once", async () => {
    // Calibre series metadata ("Oz"), same fixtures import-book.test.ts uses.
    const { id: bookId, indexed } = await importBook(
      await loadFixture("series-1.epub"),
    );
    await indexed;
    const [book] = await getAllBooks();
    const seriesId = book.seriesGroupingId!;

    const collectionId = await createCollection("To Reread");
    await addBookToCollection(collectionId, bookId);

    const members = await getMembersForBook(bookId);
    expect(members.map((m) => m.groupingId).sort()).toEqual(
      [seriesId, collectionId].sort(),
    );
  });

  it("removing a book from a collection leaves its series membership intact", async () => {
    const { id: bookId, indexed } = await importBook(
      await loadFixture("series-1.epub"),
    );
    await indexed;
    const [book] = await getAllBooks();
    const seriesId = book.seriesGroupingId!;

    const collectionId = await createCollection("To Reread");
    await addBookToCollection(collectionId, bookId);

    await removeBookFromCollection(collectionId, bookId);

    const members = await getMembersForBook(bookId);
    expect(members.map((m) => m.groupingId)).toEqual([seriesId]);
    expect(await listGroupings("collection")).toHaveLength(1);
  });

  it("cascades series and collection membership independently on book delete", async () => {
    // Two books sharing the same series so deleting one leaves the series
    // (and the collection, which never auto-deletes) still standing.
    const first = await importBook(await loadFixture("series-1.epub"));
    const second = await importBook(await loadFixture("series-2.epub"));
    await Promise.all([first.indexed, second.indexed]);

    const collectionId = await createCollection("To Reread");
    await addBookToCollection(collectionId, first.id);
    await addBookToCollection(collectionId, second.id);

    await deleteBook(second.id);

    expect(await getMembersForBook(second.id)).toHaveLength(0);
    expect(await getMembersForGrouping(collectionId)).toHaveLength(1);
    expect(await listGroupings("series")).toHaveLength(1);
    expect(await listGroupings("collection")).toHaveLength(1);
  });

  it("auto-deletes an emptied series but keeps an emptied collection", async () => {
    const { id: bookId, indexed } = await importBook(
      await loadFixture("series-1.epub"),
    );
    await indexed;

    const collectionId = await createCollection("To Reread");
    await addBookToCollection(collectionId, bookId);

    await deleteBook(bookId);

    expect(await listGroupings("series")).toHaveLength(0);
    expect(await listGroupings("collection")).toHaveLength(1);
  });
});
