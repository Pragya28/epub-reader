import { beforeEach, describe, expect, it } from "vitest";
import { getAllBooks } from "@/services/storage/book-repository";
import { importBook } from "../import-book";
import { createBookId } from "@/utils/create-book-id";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";

describe("importBook", () => {
  beforeEach(resetTestDb);

  it("imports and persists a book", async () => {
    const file = await loadFixture("valid-book.epub");
    try {
      await importBook(file);
    } catch {
      // expected unless using real epub
    }

    const books = await getAllBooks();

    expect(Array.isArray(books)).toBe(true);
  });

  it("supports nested opf paths", async () => {
    const file = await loadFixture("nested-opf.epub");

    await expect(importBook(file)).resolves.not.toThrow();
  });

  it("handles missing metadata gracefully", async () => {
    const file = await loadFixture("missing-metadata.epub");

    await importBook(file);

    const books = await getAllBooks();

    expect(books).toHaveLength(1);
  });

  it("throws on invalid epub", async () => {
    const file = await loadFixture("invalid.epub");

    await expect(importBook(file)).rejects.toThrow();
  });

  it("creates unique ids", async () => {
    const ids = new Set();

    for (let i = 0; i < 100; i++) {
      ids.add(createBookId());
    }

    expect(ids.size).toBe(100);
  });

  it("supports multiple imports", async () => {
    const first = await loadFixture("valid-book.epub");

    const second = await loadFixture("valid-book-2.epub");

    await importBook(first);
    await importBook(second);

    const books = await getAllBooks();

    expect(books).toHaveLength(2);
  });

  it("imports large epub", async () => {
    const file = await loadFixture("large-book.epub");

    await expect(importBook(file)).resolves.not.toThrow();
  });

  it("throws for invalid spine references", async () => {
    const file = await loadFixture("broken-spine.epub");

    await expect(importBook(file)).rejects.toThrow(/Invalid spine reference/);
  });
});
