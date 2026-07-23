import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { enrichBookWithProgress } from "../derive-book-status";
import type { StoredBook } from "@/services/storage/storage-types";

function makeBook(overrides: Partial<StoredBook> = {}): StoredBook {
  return {
    id: "book-1",
    title: "Test Book",
    author: "Test Author",
    language: "en",
    createdAt: Date.now(),
    fileHash: "hash-1",
    ...overrides,
  };
}

describe("enrichBookWithProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks a book with no progress as unread", () => {
    const book = makeBook({ progress: undefined });

    const enriched = enrichBookWithProgress(book);

    expect(enriched.status).toBe("unread");
    expect(enriched.progress).toBeUndefined();
  });

  it("marks a book with partial progress as reading", () => {
    const book = makeBook({
      progress: {
        chapterIndex: 3,
        totalChapters: 10,
        scrollFraction: 0.4,
        percent: 34,
        updatedAt: Date.now(),
        atDocumentEnd: false,
      },
    });

    const enriched = enrichBookWithProgress(book);

    expect(enriched.status).toBe("reading");
    expect(enriched.progress).toBe(34);
    expect(enriched.chapterIndex).toBe(3);
    expect(enriched.totalChapters).toBe(10);
  });

  it("marks a book on its last chapter but not near the end as still reading", () => {
    const book = makeBook({
      progress: {
        chapterIndex: 9, // last chapter (0-indexed, totalChapters 10)
        totalChapters: 10,
        scrollFraction: 0.5, // nowhere near the end yet
        percent: 95,
        updatedAt: Date.now(),
        atDocumentEnd: false,
      },
    });

    const enriched = enrichBookWithProgress(book);

    expect(enriched.status).toBe("reading");
  });

  it("marks a book as finished once it's on the last chapter and near its end", () => {
    const book = makeBook({
      progress: {
        chapterIndex: 9,
        totalChapters: 10,
        scrollFraction: 0.99,
        percent: 100,
        updatedAt: Date.now(),
        atDocumentEnd: true,
      },
    });

    const enriched = enrichBookWithProgress(book);

    expect(enriched.status).toBe("finished");
  });

  it("does not mark a book finished just for being near the end of a non-last chapter", () => {
    const book = makeBook({
      progress: {
        chapterIndex: 4, // not the last chapter
        totalChapters: 10,
        scrollFraction: 0.99,
        percent: 45,
        updatedAt: Date.now(),
        atDocumentEnd: false,
      },
    });

    const enriched = enrichBookWithProgress(book);

    expect(enriched.status).toBe("reading");
  });

  it("carries progressUpdatedAt through for last-read sorting", () => {
    const updatedAt = Date.now() - 1000;
    const book = makeBook({
      progress: {
        chapterIndex: 1,
        totalChapters: 10,
        scrollFraction: 0.1,
        percent: 11,
        updatedAt,
        atDocumentEnd: false,
      },
    });

    const enriched = enrichBookWithProgress(book);

    expect(enriched.progressUpdatedAt).toBe(updatedAt);
  });

  it("flags a recently-imported unread book as new", () => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const book = makeBook({ createdAt: oneDayAgo, progress: undefined });

    const enriched = enrichBookWithProgress(book);

    expect(enriched.isNew).toBe(true);
  });

  it("does not flag an old unread book as new", () => {
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const book = makeBook({ createdAt: tenDaysAgo, progress: undefined });

    const enriched = enrichBookWithProgress(book);

    expect(enriched.isNew).toBe(false);
  });

  it("never flags a book with progress as new, regardless of import date", () => {
    const justNow = Date.now();
    const book = makeBook({
      createdAt: justNow,
      progress: {
        chapterIndex: 0,
        totalChapters: 10,
        scrollFraction: 0.1,
        percent: 1,
        updatedAt: justNow,
        atDocumentEnd: false,
      },
    });

    const enriched = enrichBookWithProgress(book);

    expect(enriched.isNew).toBe(false);
  });
});
