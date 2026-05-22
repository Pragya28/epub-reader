import { describe, expect, it } from "vitest";

import { useLibraryStore } from "../library-store";
import { saveBookMetadata } from "@/services/storage/book-repository";
import { loadLibrary } from "../../actions/load-library";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { importBook } from "../../actions/import-book";

describe("library store", () => {
  it("adds books", () => {
    useLibraryStore.getState().addBook({
      id: "1",
      title: "Test",
      createdAt: 1,
      fileHash: "book-1",
    });
    const books = useLibraryStore.getState().books;
    expect(books).toHaveLength(1);
  });

  it("loads persisted books into store", async () => {
    await saveBookMetadata({
      id: "1",
      title: "Stored Book",
      createdAt: 1,
      fileHash: "book-1",
    });
    await loadLibrary();
    const books = useLibraryStore.getState().books;
    expect(books).toHaveLength(1);
  });

  it("updates store after import", async () => {
    const file = await loadFixture("valid-book.epub");
    await importBook(file);
    const books = useLibraryStore.getState().books;
    expect(books.length).toBeGreaterThan(0);
  });
});
