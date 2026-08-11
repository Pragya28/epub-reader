import { describe, expect, it } from "vitest";

import { filterSearchResultsByStatus } from "../filter-search-results";
import type { BookWithProgress } from "../../types/library.types";
import type { LibrarySearchResults } from "../../actions/search-library";

const book = (id: string, isFinished: boolean): BookWithProgress =>
  ({ id, title: `Book ${id}`, isFinished }) as BookWithProgress;

const books = [book("done", true), book("wip", false)];

const results: LibrarySearchResults = {
  metadataMatches: [book("done", true), book("wip", false)],
  contentMatches: [
    { bookId: "done", chapter: 1, matchedWords: ["harry"] },
    { bookId: "wip", chapter: 2, matchedWords: ["harry"] },
  ],
};

describe("filterSearchResultsByStatus", () => {
  it("hides finished books by default and reports how many", () => {
    const scoped = filterSearchResultsByStatus(results, books, "unfinished");

    expect(scoped.metadataMatches.map((b) => b.id)).toEqual(["wip"]);
    expect(scoped.contentMatches.map((m) => m.bookId)).toEqual(["wip"]);
    expect(scoped.hiddenCount).toBe(2);
  });

  it("shows everything with no hidden count under 'all'", () => {
    const scoped = filterSearchResultsByStatus(results, books, "all");

    expect(scoped.metadataMatches).toHaveLength(2);
    expect(scoped.contentMatches).toHaveLength(2);
    expect(scoped.hiddenCount).toBe(0);
  });

  it("shows only finished books under 'finished'", () => {
    const scoped = filterSearchResultsByStatus(results, books, "finished");

    expect(scoped.metadataMatches.map((b) => b.id)).toEqual(["done"]);
    expect(scoped.contentMatches.map((m) => m.bookId)).toEqual(["done"]);
    expect(scoped.hiddenCount).toBe(2);
  });

  it("keeps a content match whose book isn't in the list", () => {
    const orphan: LibrarySearchResults = {
      metadataMatches: [],
      contentMatches: [{ bookId: "gone", chapter: 0, matchedWords: ["x"] }],
    };

    const scoped = filterSearchResultsByStatus(orphan, books, "unfinished");

    expect(scoped.contentMatches).toHaveLength(1);
  });
});
