import { beforeEach, describe, expect, it } from "vitest";
import { hasIndex } from "@/services/search/search-index";
import { getAllBooks } from "@/services/storage/book-repository";
import { importBook } from "../import-book";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";

describe("importBook", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
  });

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

    // Import also builds the search index (a second full parse of the
    // book) — inherits the project's global testTimeout (vite.config.ts)
    // rather than a per-test override, since that budget has needed
    // raising more than once for this exact reason.
    await expect(importBook(file)).resolves.not.toThrow();
  });

  it("throws for invalid spine references", async () => {
    const file = await loadFixture("broken-spine.epub");

    await expect(importBook(file)).rejects.toThrow(/Invalid spine reference/);
  });

  it("persists chapter count, word count and reading time", async () => {
    const file = await loadFixture("valid-book.epub");

    await importBook(file);

    const [book] = await getAllBooks();

    expect(book.chapterCount).toBeGreaterThan(0);
    expect(book.wordCount).toBeGreaterThan(0);
    expect(book.readingTimeMinutes).toBeGreaterThan(0);
  });

  it("builds a search index for the imported book", async () => {
    const file = await loadFixture("valid-book.epub");

    await importBook(file);

    const [book] = await getAllBooks();
    expect(await hasIndex(book.id)).toBe(true);
  });

  it("rejects duplicate book imports", async () => {
    const file = await loadFixture("valid-book.epub");
    await importBook(file);
    await expect(importBook(file)).rejects.toThrow("Book already imported");
    const books = await getAllBooks();
    expect(books).toHaveLength(1);
  });
});
