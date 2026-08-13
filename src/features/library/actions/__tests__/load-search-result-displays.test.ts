import { describe, expect, it, vi, beforeEach } from "vitest";

import { resetTestDb } from "@/tests/utils/reset-test-db";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { EpubParser } from "@/services/epub/epub-parser";
import { buildIndex } from "@/services/search/search-service";
import { db } from "@/services/storage/db";
import * as bookRepository from "@/services/storage/book-repository";
import { loadSearchResultDisplays } from "../load-search-result-displays";
import type { ChapterMatch } from "@/services/search/search-content";

describe("loadSearchResultDisplays", () => {
  beforeEach(async () => {
    await resetTestDb();
    vi.restoreAllMocks();
  });

  it("uses the chapter-text cache without parsing the book", async () => {
    const file = await loadFixture("valid-book.epub");

    // Populates books + the chapter-text cache, exactly like a real import.
    await db.books.put({
      id: "book-1",
      title: "Cached Book",
      author: "Cache Author",
      createdAt: 0,
      fileHash: "h1",
    });
    await buildIndex("book-1", file);

    // If this test hit the fallback path it would need the raw file, which
    // isn't stored here — proves the assertion below isn't accidentally
    // passing because the fallback silently no-ops.
    const parseSpy = vi.spyOn(EpubParser.prototype, "parseBook");
    const getWithFileSpy = vi.spyOn(bookRepository, "getBookWithFile");

    const matches: ChapterMatch[] = [
      { bookId: "book-1", chapter: 0, matchedWords: ["chapter"] },
    ];

    const rows = await loadSearchResultDisplays(matches, new Map(), new Map());

    expect(rows).toHaveLength(1);
    expect(rows[0].bookTitle).toBe("Cached Book");
    expect(rows[0].bookAuthor).toBe("Cache Author");
    expect(rows[0].snippet.length).toBeGreaterThan(0);
    expect(parseSpy).not.toHaveBeenCalled();
    expect(getWithFileSpy).not.toHaveBeenCalled();
  });

  it("falls back to parsing when a chapter has no cached text", async () => {
    const file = await loadFixture("valid-book.epub");

    await db.books.put({
      id: "book-2",
      title: "Uncached Book",
      author: "Fallback Author",
      createdAt: 0,
      fileHash: "h2",
    });
    // No buildIndex call — this book predates the text cache, same as any
    // book indexed before Sprint 6B.
    vi.spyOn(bookRepository, "getBookWithFile").mockResolvedValue({
      book: {
        id: "book-2",
        title: "Uncached Book",
        fileHash: "h2",
        createdAt: 0,
      },
      file,
    } as Awaited<ReturnType<typeof bookRepository.getBookWithFile>>);

    const matches: ChapterMatch[] = [
      { bookId: "book-2", chapter: 0, matchedWords: ["chapter"] },
    ];

    const rows = await loadSearchResultDisplays(matches, new Map(), new Map());

    expect(rows).toHaveLength(1);
    expect(rows[0].bookTitle).toBe("Uncached Book");
    expect(rows[0].snippet.length).toBeGreaterThan(0);
  });

  it("drops a match whose book no longer exists", async () => {
    const file = await loadFixture("valid-book.epub");

    await db.books.put({
      id: "book-3",
      title: "Deleted Later",
      createdAt: 0,
      fileHash: "h3",
    });
    await buildIndex("book-3", file);
    await db.books.delete("book-3"); // book removed, index/text cache orphaned

    const matches: ChapterMatch[] = [
      { bookId: "book-3", chapter: 0, matchedWords: ["chapter"] },
    ];

    const rows = await loadSearchResultDisplays(matches, new Map(), new Map());

    expect(rows).toHaveLength(0);
  });
});
