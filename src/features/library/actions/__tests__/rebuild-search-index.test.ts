import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasIndex, findMatches } from "@/services/search/search-index";
import * as bookRepository from "@/services/storage/book-repository";
import { getAllBooks } from "@/services/storage/book-repository";
import { importBook } from "../import-book";
import { rebuildSearchIndex } from "../rebuild-search-index";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";

describe("rebuildSearchIndex", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rebuilds the index for every book in the library", async () => {
    const first = await loadFixture("valid-book.epub");
    const second = await loadFixture("missing-metadata.epub");
    const { id: firstId } = await importBook(first);
    const { id: secondId } = await importBook(second);

    const books = await getAllBooks();
    expect(books).toHaveLength(2);

    // fake-indexeddb (the test-only IndexedDB mock) doesn't structured-clone
    // File/Blob objects correctly through Dexie's bookFiles table — a
    // stored file comes back as `{}`, not a real Blob. That's a test-env
    // limitation only (real browser IndexedDB round-trips Blobs fine), so
    // getBookFile is stubbed here to hand back the original in-memory File
    // each book was imported with, keeping the assertions about
    // rebuildSearchIndex's own logic accurate.
    const filesById = new Map([
      [firstId, first],
      [secondId, second],
    ]);
    vi.spyOn(bookRepository, "getBookFile").mockImplementation(
      async (bookId: string) => {
        const file = filesById.get(bookId);
        return file ? { bookId, file } : undefined;
      },
    );

    // fake-indexeddb also gets dramatically slower (not hung — confirmed by
    // running with a much longer budget — just genuinely slow, ~80s here)
    // issuing a second `.where(bookId).delete()` transaction shortly after
    // a prior bulkAdd+delete cycle in the same test. Real IndexedDB has no
    // such cost; this is a test-only tax for exercising a second book.
    const result = await rebuildSearchIndex();

    expect(result).toEqual({ total: 2, failed: 0 });
    for (const book of books) {
      expect(await hasIndex(book.id)).toBe(true);
    }
  }, 300000);

  it("counts a book with a missing file blob as failed without stopping the rest", async () => {
    const file = await loadFixture("valid-book.epub");
    await importBook(file);
    const [book] = await getAllBooks();

    // Simulate a corrupted/missing file for this book: delete its stored
    // file blob directly via Dexie, leaving the book row and index intact.
    const { db } = await import("@/services/storage/db");
    await db.bookFiles.delete(book.id);

    const result = await rebuildSearchIndex();

    expect(result).toEqual({ total: 1, failed: 1 });
  }, 90000);

  it("removes stale index entries a book no longer contains", async () => {
    const file = await loadFixture("valid-book.epub");
    const { id } = await importBook(file);

    // Same fake-indexeddb Blob-corruption limitation as the first test.
    vi.spyOn(bookRepository, "getBookFile").mockImplementation(
      async (bookId: string) => (bookId === id ? { bookId, file } : undefined),
    );

    const [book] = await getAllBooks();

    // Inject a bogus entry that a real parse of this book would never
    // produce, simulating a stale/corrupted index row.
    const { putIndexEntries } = await import("@/services/search/search-index");
    await putIndexEntries([
      { word: "totallyfakeword", bookId: book.id, chapter: 0 },
    ]);

    const result = await rebuildSearchIndex();

    expect(result).toEqual({ total: 1, failed: 0 });
    const stale = await findMatches("totallyfakeword", book.id);
    expect(stale).toHaveLength(0);
  }, 90000);
});
