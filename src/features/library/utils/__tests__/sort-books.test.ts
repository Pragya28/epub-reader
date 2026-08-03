import { describe, expect, it } from "vitest";
import { sortBooks } from "../sort-books";
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

describe("sortBooks", () => {
  const books = [
    makeBook({
      id: "1",
      title: "Charlie",
      author: "Z Author",
      createdAt: 100,
      progressUpdatedAt: 5,
      progress: 20,
      status: "reading",
    }),
    makeBook({
      id: "2",
      title: "Alpha",
      author: "A Author",
      createdAt: 300,
      progressUpdatedAt: 20,
      progress: 90,
      status: "finished",
    }),
    makeBook({
      id: "3",
      title: "Bravo",
      author: "M Author",
      createdAt: 200,
      progressUpdatedAt: undefined,
      progress: undefined,
      status: "unread",
    }),
  ];

  it("does not mutate the input array", () => {
    const copy = [...books];
    sortBooks(books, "title");
    expect(books).toEqual(copy);
  });

  it("sorts by recently imported (createdAt desc)", () => {
    const result = sortBooks(books, "recentlyImported");
    expect(result.map((b) => b.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by recently opened, missing timestamps last", () => {
    const result = sortBooks(books, "recentlyOpened");
    expect(result.map((b) => b.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by title A-Z", () => {
    const result = sortBooks(books, "title");
    expect(result.map((b) => b.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by author A-Z", () => {
    const result = sortBooks(books, "author");
    expect(result.map((b) => b.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by reading progress, highest first", () => {
    const result = sortBooks(books, "progress");
    expect(result.map((b) => b.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by status: reading, unread, finished", () => {
    const result = sortBooks(books, "status");
    expect(result.map((b) => b.id)).toEqual(["1", "3", "2"]);
  });
});
