import { describe, expect, it } from "vitest";
import {
  formatReadingProgress,
  formatReadingTime,
  formatSeriesLink,
} from "../format-book-details";
import type { BookWithProgress } from "../../types/library.types";

function makeBook(overrides: Partial<BookWithProgress> = {}): BookWithProgress {
  return {
    id: "1",
    title: "Test Book",
    createdAt: 0,
    fileHash: "hash",
    status: "unread",
    ...overrides,
  };
}

describe("formatReadingProgress", () => {
  it("shows Not Started with chapter count", () => {
    const book = makeBook({ status: "unread", chapterCount: 12 });

    expect(formatReadingProgress(book)).toBe("Not Started • 12 Chapters");
  });

  it("shows Not Started without a count when chapter count is unknown", () => {
    const book = makeBook({ status: "unread" });

    expect(formatReadingProgress(book)).toBe("Not Started");
  });

  it("shows Finished with chapter count", () => {
    const book = makeBook({ status: "finished", chapterCount: 12 });

    expect(formatReadingProgress(book)).toBe("Finished • 12 Chapters");
  });

  it("shows current / total chapters while reading", () => {
    const book = makeBook({
      status: "reading",
      chapterCount: 12,
      chapterIndex: 3,
    });

    expect(formatReadingProgress(book)).toBe("4 / 12 Chapters");
  });

  it("falls back to progress.totalChapters when chapterCount is missing", () => {
    const book = makeBook({
      status: "reading",
      totalChapters: 8,
      chapterIndex: 0,
    });

    expect(formatReadingProgress(book)).toBe("1 / 8 Chapters");
  });

  it("hides the row entirely when reading with no known total", () => {
    const book = makeBook({ status: "reading", chapterIndex: 2 });

    expect(formatReadingProgress(book)).toBeNull();
  });

  it("clamps the current chapter to the total", () => {
    const book = makeBook({
      status: "reading",
      chapterCount: 5,
      chapterIndex: 99,
    });

    expect(formatReadingProgress(book)).toBe("5 / 5 Chapters");
  });
});

describe("formatSeriesLink", () => {
  it("includes the book's position and series total", () => {
    expect(formatSeriesLink("Harry Potter", 3, 7)).toBe(
      "3/7 of Harry Potter • View Series",
    );
  });

  it("omits the position prefix when the book has no seriesIndex", () => {
    expect(formatSeriesLink("Harry Potter", undefined, 7)).toBe(
      "Harry Potter • View Series",
    );
  });
});

describe("formatReadingTime", () => {
  it("formats under an hour as minutes", () => {
    expect(formatReadingTime(45)).toBe("45 min read");
  });

  it("formats an exact hour with no minutes", () => {
    expect(formatReadingTime(120)).toBe("2 hr read");
  });

  it("formats hours with remaining minutes", () => {
    expect(formatReadingTime(125)).toBe("2 hr 5 min read");
  });
});
