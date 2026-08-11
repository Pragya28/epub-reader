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

vi.mock("../../actions/load-library", () => ({
  loadLibrary: vi.fn(async () => {}),
}));

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

  it("loads the library when reached with an empty store", async () => {
    // Caught by a live pass, not by tests: arriving at /search directly (deep
    // link or a refresh on this screen) left `books` empty, which silently
    // broke metadata search and made the status filter a no-op, since content
    // matches couldn't resolve their book to a reading status.
    const { loadLibrary } = await import("../../actions/load-library");
    libraryStore.setState({ books: [], isLoading: false, error: null });

    renderHook(() => useSearchScreen());

    await waitFor(() => expect(loadLibrary).toHaveBeenCalled());
  });

  it("reports loading while a search is in flight, then settles", async () => {
    const { result } = renderHook(() => useSearchScreen());

    act(() => result.current.setQuery("weight"));
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("clears results and stops loading when the search rejects", async () => {
    const { searchLibrary } = await import("../../actions/search-library");
    vi.mocked(searchLibrary).mockRejectedValueOnce(new Error("index broken"));

    const { result } = renderHook(() => useSearchScreen());

    act(() => result.current.setQuery("weight"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resultCount).toBe(0);
  });
});
