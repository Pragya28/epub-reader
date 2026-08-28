import { beforeEach, describe, expect, it } from "vitest";

import { importBook } from "../import-book";
import { deleteBook } from "../delete-book";
import {
  getAllBooks,
  getBookCover,
  getBookFile,
  updateBookProgress,
} from "@/services/storage/book-repository";
import { libraryStore } from "../../store/library-store";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";
import { clearCoverCache } from "@/services/storage/cover-cache";

describe("book lifecycle: import -> read -> delete", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
    clearCoverCache();
  });

  it("imports a book, records reading progress, then fully removes it", async () => {
    const file = await loadFixture("valid-book.epub");

    const { id: bookId, indexed } = await importBook(file);
    await indexed; // indexing runs in the background — settle it before delete

    let books = await getAllBooks();
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe(bookId);
    expect(libraryStore.getState().books).toHaveLength(1);

    // "Read": simulate progress the way the reader engine saves it.
    await updateBookProgress(bookId, {
      chapterIndex: 1,
      totalChapters: 12,
      scrollFraction: 0.5,
      atDocumentEnd: false,
      updatedAt: Date.now(),
      percent: 8,
    });

    books = await getAllBooks();
    expect(books[0].progress?.chapterIndex).toBe(1);
    expect(await getBookFile(bookId)).toBeDefined();

    await deleteBook(bookId);

    books = await getAllBooks();
    expect(books).toHaveLength(0);
    expect(libraryStore.getState().books).toHaveLength(0);
    expect(await getBookFile(bookId)).toBeUndefined();
    expect(await getBookCover(bookId)).toBeUndefined();
  });
});
