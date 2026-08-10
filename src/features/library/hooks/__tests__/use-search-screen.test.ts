import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSearchScreen } from "../use-search-screen";
import { libraryStore } from "../../store/library-store";
import type { StoredBook } from "@/services/storage/storage-types";

const book: StoredBook = {
  id: "b1",
  title: "The Weight of Forever",
  author: "Eleanor Vance",
  fileHash: "h1",
  createdAt: Date.now(),
} as StoredBook;

vi.mock("../../actions/search-library", () => ({
  searchLibrary: vi.fn(async (_books: unknown, query: string) => {
    if (!query.trim()) return { metadataMatches: [], contentMatches: [] };
    return {
      metadataMatches: [{ id: "b1", title: "The Weight of Forever" }],
      contentMatches: [
        { bookId: "b1", chapter: 2, matchedWords: ["eternity"] },
      ],
    };
  }),
}));

describe("useSearchScreen", () => {
  beforeEach(() => {
    libraryStore.setState({ books: [book], isLoading: false, error: null });
  });

  it("returns empty results for an empty query", () => {
    const { result } = renderHook(() => useSearchScreen());
    expect(result.current.metadataMatches).toEqual([]);
    expect(result.current.contentMatches).toEqual([]);
    expect(result.current.resultCount).toBe(0);
    expect(result.current.isSearching).toBe(false);
  });

  it("populates results once a query is set", async () => {
    const { result } = renderHook(() => useSearchScreen());

    act(() => result.current.setQuery("weight of eternity"));

    await waitFor(() => expect(result.current.resultCount).toBe(2));
    expect(result.current.metadataMatches).toHaveLength(1);
    expect(result.current.contentMatches).toHaveLength(1);
    expect(result.current.isSearching).toBe(true);
  });
});
