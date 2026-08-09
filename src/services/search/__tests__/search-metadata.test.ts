import { describe, expect, it } from "vitest";
import { filterBooksByQuery } from "../search-metadata";

interface TestBook {
  id: string;
  title: string;
  author?: string;
  description?: string;
}

describe("filterBooksByQuery", () => {
  const books: TestBook[] = [
    { id: "1", title: "The Frail Lady", author: "Empress Crimson" },
    {
      id: "2",
      title: "Sallows and Nightingales",
      author: "A. Writer",
      description: "A dark academy romance.",
    },
    { id: "3", title: "Untitled Draft" },
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
