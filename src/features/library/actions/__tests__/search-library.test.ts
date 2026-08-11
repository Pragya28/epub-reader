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
});
