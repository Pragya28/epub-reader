import { describe, expect, it } from "vitest";
import {
  filterBooksByCriteria,
  filterBooksByQuery,
  getLengthBucket,
  hasActiveFilters,
  type LibraryFilters,
} from "../filter-books";
import type { BookWithProgress } from "../../types/library.types";

function makeBook(overrides: Partial<BookWithProgress> = {}): BookWithProgress {
  return {
    id: overrides.id ?? "1",
    title: "Test Book",
    createdAt: 0,
    fileHash: "hash",
    status: "unread",
    ...overrides,
  };
}

describe("filterBooksByQuery", () => {
  const books = [
    makeBook({ id: "1", title: "The Frail Lady", author: "Empress Crimson" }),
    makeBook({
      id: "2",
      title: "Sallows and Nightingales",
      author: "A. Writer",
      description: "A dark academy romance.",
    }),
    makeBook({ id: "3", title: "Untitled Draft" }),
  ];

  it("returns every book for an empty query", () => {
    expect(filterBooksByQuery(books, "")).toHaveLength(3);
  });

  it("returns every book for a whitespace-only query", () => {
    expect(filterBooksByQuery(books, "   ")).toHaveLength(3);
  });

  it("matches by title, case-insensitively", () => {
    const result = filterBooksByQuery(books, "frail");

    expect(result.map((b) => b.id)).toEqual(["1"]);
  });

  it("matches by author", () => {
    const result = filterBooksByQuery(books, "crimson");

    expect(result.map((b) => b.id)).toEqual(["1"]);
  });

  it("matches by description", () => {
    const result = filterBooksByQuery(books, "academy");

    expect(result.map((b) => b.id)).toEqual(["2"]);
  });

  it("skips books with no author/description without throwing", () => {
    const result = filterBooksByQuery(books, "untitled");

    expect(result.map((b) => b.id)).toEqual(["3"]);
  });

  it("returns nothing when no field matches", () => {
    expect(filterBooksByQuery(books, "nonexistent")).toHaveLength(0);
  });
});

describe("getLengthBucket", () => {
  it("returns null for an unknown word count", () => {
    expect(getLengthBucket(undefined)).toBeNull();
  });

  it("buckets short reads under 20k words", () => {
    expect(getLengthBucket(5_000)).toBe("short");
    expect(getLengthBucket(19_999)).toBe("short");
  });

  it("buckets medium reads 20k-80k words", () => {
    expect(getLengthBucket(20_000)).toBe("medium");
    expect(getLengthBucket(79_999)).toBe("medium");
  });

  it("buckets long reads 80k-150k words", () => {
    expect(getLengthBucket(80_000)).toBe("long");
    expect(getLengthBucket(149_999)).toBe("long");
  });

  it("buckets epic reads at 150k+ words", () => {
    expect(getLengthBucket(150_000)).toBe("epic");
    expect(getLengthBucket(500_000)).toBe("epic");
  });
});

describe("hasActiveFilters", () => {
  it("is false when every filter is 'all'", () => {
    expect(
      hasActiveFilters({
        status: "all",
        language: "all",
        author: "all",
        length: "all",
      }),
    ).toBe(false);
  });

  it("is true when any single filter is set", () => {
    expect(
      hasActiveFilters({
        status: "reading",
        language: "all",
        author: "all",
        length: "all",
      }),
    ).toBe(true);
  });
});

describe("filterBooksByCriteria", () => {
  const books = [
    makeBook({
      id: "1",
      status: "reading",
      language: "en",
      author: "Author A",
      wordCount: 15_000,
    }),
    makeBook({
      id: "2",
      status: "finished",
      language: "fr",
      author: "Author B",
      wordCount: 90_000,
    }),
    makeBook({
      id: "3",
      status: "unread",
      language: "en",
      author: "Author A",
      wordCount: 200_000,
    }),
  ];

  const allFilters: LibraryFilters = {
    status: "all",
    language: "all",
    author: "all",
    length: "all",
  };

  it("returns every book when no filter is active", () => {
    expect(filterBooksByCriteria(books, allFilters)).toHaveLength(3);
  });

  it("filters by reading status", () => {
    const result = filterBooksByCriteria(books, {
      ...allFilters,
      status: "finished",
    });
    expect(result.map((b) => b.id)).toEqual(["2"]);
  });

  it("filters by language", () => {
    const result = filterBooksByCriteria(books, {
      ...allFilters,
      language: "en",
    });
    expect(result.map((b) => b.id)).toEqual(["1", "3"]);
  });

  it("filters by author", () => {
    const result = filterBooksByCriteria(books, {
      ...allFilters,
      author: "Author A",
    });
    expect(result.map((b) => b.id)).toEqual(["1", "3"]);
  });

  it("filters by book-length bucket", () => {
    const result = filterBooksByCriteria(books, {
      ...allFilters,
      length: "epic",
    });
    expect(result.map((b) => b.id)).toEqual(["3"]);
  });

  it("combines multiple filter dimensions", () => {
    const result = filterBooksByCriteria(books, {
      ...allFilters,
      language: "en",
      status: "unread",
    });
    expect(result.map((b) => b.id)).toEqual(["3"]);
  });
});
