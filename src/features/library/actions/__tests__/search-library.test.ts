import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureIndexesForBooks } from "@/services/search/search-service";
import { searchLibrary } from "../search-library";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import type { BookWithProgress } from "../../types/library.types";

vi.mock("@/services/search/search-service", () => ({
  ensureIndexesForBooks: vi.fn().mockResolvedValue(undefined),
}));

const createBook = (id: string): BookWithProgress =>
  ({
    id,
    title: `Book ${id}`,
    author: "Author",
    language: "en",
    description: "",
    chapterCount: 1,
    wordCount: 100,
    readingTimeMinutes: 1,
    createdAt: Date.now(),
    fileHash: `hash-${id}`,
  }) as BookWithProgress;

describe("searchLibrary", () => {
  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();
  });

  it("backfills search indexes for all books being searched before querying", async () => {
    const books = [createBook("book-1"), createBook("book-2")];

    await searchLibrary(books, "chapter");

    expect(ensureIndexesForBooks).toHaveBeenCalledWith(["book-1", "book-2"]);
  });

  it("still returns metadata matches when the index backfill fails", async () => {
    // Regression guard: a library imported before search indexing shipped
    // backfills every book on first search, and one unreadable book used to
    // reject the whole call — showing "0 results found" for a title that
    // plainly matches.
    vi.mocked(ensureIndexesForBooks).mockRejectedValueOnce(
      new Error("no stored file"),
    );

    const results = await searchLibrary(
      [createBook("book-1"), createBook("book-2")],
      "Book book-1",
    );

    expect(results.metadataMatches).toHaveLength(1);
    expect(results.contentMatches).toEqual([]);
  });
});
