import { describe, expect, it, vi, beforeEach } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { loadFixture } from "@/tests/utils/load-fixtures";
import {
  buildIndex,
  ensureIndex,
  ensureIndexesForBooks,
} from "../search-service";
import { findMatches, hasIndex } from "../search-index";
import { getChapterText } from "../chapter-text";
import * as chapterText from "../chapter-text";

// Storing a real Blob in fake-indexeddb and reading it back doesn't survive
// the round trip intact in this jsdom test environment (loses its Blob
// prototype/size), so ensureIndexesForBooks's file-fetch step is mocked
// here rather than exercised through real Dexie storage.
vi.mock("@/services/storage/book-files", () => ({
  getBookFile: vi.fn(),
}));

describe("search-service", () => {
  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();
  });

  it("builds and queries an index for a real EPUB fixture", async () => {
    const file = await loadFixture("valid-book.epub");

    expect(await hasIndex("book-1")).toBe(false);

    await buildIndex("book-1", file);

    expect(await hasIndex("book-1")).toBe(true);

    const matches = await findMatches("chapter", "book-1");
    expect(Array.isArray(matches)).toBe(true);
  });

  it("ensureIndex skips rebuilding an existing index", async () => {
    const file = await loadFixture("valid-book.epub");

    await buildIndex("book-2", file);
    const before = await findMatches("chapter", "book-2");

    await ensureIndex("book-2", file);
    const after = await findMatches("chapter", "book-2");

    expect(after.length).toBe(before.length);
  });

  it("ensureIndexesForBooks backfills only books missing an index", async () => {
    const { getBookFile } = await import("@/services/storage/book-files");
    const file = await loadFixture("valid-book.epub");
    vi.mocked(getBookFile).mockResolvedValue({ bookId: "book-4", file });

    await buildIndex("book-3", await loadFixture("valid-book.epub"));

    expect(await hasIndex("book-3")).toBe(true);
    expect(await hasIndex("book-4")).toBe(false);

    await ensureIndexesForBooks(["book-3", "book-4"]);

    expect(await hasIndex("book-3")).toBe(true);
    expect(await hasIndex("book-4")).toBe(true);
    // Only the missing book's file was fetched — the already-indexed one
    // was skipped by the hasIndex check before any file read.
    expect(getBookFile).toHaveBeenCalledTimes(1);
    expect(getBookFile).toHaveBeenCalledWith("book-4");
  });

  it("ensureIndexesForBooks skips a book with no stored file", async () => {
    const { getBookFile } = await import("@/services/storage/book-files");
    vi.mocked(getBookFile).mockResolvedValue(undefined);

    await expect(ensureIndexesForBooks(["book-5"])).resolves.not.toThrow();
    expect(await hasIndex("book-5")).toBe(false);
  });

  it("ensureIndexesForBooks still indexes other books when one fails", async () => {
    const { getBookFile } = await import("@/services/storage/book-files");
    const file = await loadFixture("valid-book.epub");

    // book-6's file is unparseable (stands in for a corrupt file or an
    // exhausted storage quota); book-7's is fine and must still be indexed.
    vi.mocked(getBookFile).mockImplementation(async (bookId: string) =>
      bookId === "book-6"
        ? { bookId, file: new Blob(["not an epub"]) }
        : { bookId, file },
    );

    await expect(
      ensureIndexesForBooks(["book-6", "book-7"]),
    ).resolves.not.toThrow();

    expect(await hasIndex("book-6")).toBe(false);
    expect(await hasIndex("book-7")).toBe(true);
  });

  it("caches plain text and a TOC label for every chapter it indexes", async () => {
    const file = await loadFixture("valid-book.epub");

    await buildIndex("book-8", file);

    const cached = await getChapterText("book-8", 0);
    expect(cached).toBeDefined();
    expect(cached?.text.length).toBeGreaterThan(0);
    // Plain text, not markup — the whole point of caching it.
    expect(cached?.text).not.toMatch(/<[^>]+>/);
  });

  it("still builds the word index if caching chapter text fails", async () => {
    vi.spyOn(chapterText, "putChapterTexts").mockRejectedValueOnce(
      new Error("quota exceeded"),
    );

    const file = await loadFixture("valid-book.epub");

    await expect(buildIndex("book-9", file)).resolves.not.toThrow();
    expect(await hasIndex("book-9")).toBe(true);
  });
});
