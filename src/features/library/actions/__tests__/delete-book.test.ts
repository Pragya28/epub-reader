import { beforeEach, describe, expect, it, vi } from "vitest";
import { EpubParser } from "@/services/epub/epub-parser";
import { hasIndex } from "@/services/search/search-index";
import { getAllBooks } from "@/services/storage/book-repository";
import { getMembersForBook, listGroupings } from "@/services/storage/groupings";
import { createCollection, addBookToCollection } from "../collections";
import { deleteBook } from "../delete-book";
import { importBook } from "../import-book";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";

describe("deleteBook", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
  });

  it("removes the book's search index", async () => {
    const file = await loadFixture("valid-book.epub");
    const { indexed } = await importBook(file);
    await indexed; // indexing runs in the background — wait for it here
    const [book] = await getAllBooks();

    expect(await hasIndex(book.id)).toBe(true);

    await deleteBook(book.id);

    expect(await hasIndex(book.id)).toBe(false);
  });

  it("removes series membership and deletes an emptied series grouping", async () => {
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
    await indexed; // indexing runs in the background — settle it before delete
    const [book] = await getAllBooks();

    await deleteBook(book.id);

    expect(await getMembersForBook(book.id)).toHaveLength(0);
    expect(await listGroupings("series")).toHaveLength(0);
  });

  it("removes collection membership but keeps the emptied collection", async () => {
    const file = await loadFixture("valid-book.epub");
    const { indexed } = await importBook(file);
    await indexed; // indexing runs in the background — settle it before delete
    const [book] = await getAllBooks();

    const collectionId = await createCollection("Favorites");
    await addBookToCollection(collectionId, book.id);
    expect(await getMembersForBook(book.id)).toHaveLength(1);

    await deleteBook(book.id);

    expect(await getMembersForBook(book.id)).toHaveLength(0);
    expect(await listGroupings("collection")).toHaveLength(1);
  });
});
