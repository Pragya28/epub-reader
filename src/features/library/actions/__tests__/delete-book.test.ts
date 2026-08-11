import { beforeEach, describe, expect, it } from "vitest";
import { hasIndex } from "@/services/search/search-index";
import { getAllBooks } from "@/services/storage/book-repository";
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
    await importBook(file);
    const [book] = await getAllBooks();

    expect(await hasIndex(book.id)).toBe(true);

    await deleteBook(book.id);

    expect(await hasIndex(book.id)).toBe(false);
  });
});
