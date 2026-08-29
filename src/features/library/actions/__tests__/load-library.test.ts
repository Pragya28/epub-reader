import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/storage/book-repository", () => ({
  getAllBooks: vi.fn(),
  getBookCoverUrl: vi.fn(),
}));

import {
  getAllBooks,
  getBookCoverUrl,
} from "@/services/storage/book-repository";
import { loadLibrary } from "../load-library";
import { libraryStore } from "../../store/library-store";
import { pwaStore } from "@/features/pwa/store/pwa-store";
import { resetLibraryStore, resetPwaStore } from "@/tests/utils/reset-store";
import type { StoredBook } from "@/services/storage/storage-types";

const mockedGetAllBooks = vi.mocked(getAllBooks);
const mockedGetBookCoverUrl = vi.mocked(getBookCoverUrl);

describe("loadLibrary", () => {
  beforeEach(() => {
    resetLibraryStore();
    resetPwaStore();
    vi.clearAllMocks();
    mockedGetBookCoverUrl.mockResolvedValue(undefined);
  });

  it("loads books into the store", async () => {
    const books: StoredBook[] = [
      {
        id: "book-1",
        fileHash: "hash-1",
        title: "Test Book",
        author: "Test Author",
        language: "en",
        createdAt: 1,
      },
    ];

    mockedGetAllBooks.mockResolvedValue(books);

    await loadLibrary();

    const state = libraryStore.getState();

    expect(state.books).toEqual(books);
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("sets error when repository fails", async () => {
    mockedGetAllBooks.mockRejectedValue(new Error("Database failure"));

    await loadLibrary();

    const state = libraryStore.getState();

    expect(state.error).toContain("Database failure");
    expect(state.isLoading).toBe(false);
  });

  it("toggles loading state during load", async () => {
    let loadingDuringFetch = false;

    mockedGetAllBooks.mockImplementation(async () => {
      loadingDuringFetch = libraryStore.getState().isLoading;
      return [];
    });

    await loadLibrary();

    expect(loadingDuringFetch).toBe(true);
    expect(libraryStore.getState().isLoading).toBe(false);
  });

  it("clears loading state when repository throws", async () => {
    mockedGetAllBooks.mockRejectedValue(new Error("Unexpected failure"));

    await loadLibrary();

    expect(libraryStore.getState().isLoading).toBe(false);
  });

  describe("eviction detection", () => {
    const oneBook: StoredBook[] = [
      {
        id: "book-1",
        fileHash: "hash-1",
        title: "Test Book",
        author: "Test Author",
        language: "en",
        createdAt: 1,
      },
    ];

    it("marks the user past first-run and records hadBooks when the library is non-empty", async () => {
      mockedGetAllBooks.mockResolvedValue(oneBook);

      await loadLibrary();

      expect(pwaStore.getState().hadBooks).toBe(true);
      expect(pwaStore.getState().firstImportDone).toBe(true);
      expect(libraryStore.getState().evicted).toBe(false);
    });

    it("flags eviction when a previously-populated library loads empty", async () => {
      pwaStore.getState().setHadBooks(true);
      mockedGetAllBooks.mockResolvedValue([]);

      await loadLibrary();

      expect(libraryStore.getState().evicted).toBe(true);
    });

    it("does not flag eviction for a genuine first-run empty library", async () => {
      mockedGetAllBooks.mockResolvedValue([]);

      await loadLibrary();

      expect(libraryStore.getState().evicted).toBe(false);
    });

    it("clears a stale eviction flag once books load again", async () => {
      pwaStore.getState().setHadBooks(true);
      libraryStore.getState().setEvicted(true);
      mockedGetAllBooks.mockResolvedValue(oneBook);

      await loadLibrary();

      expect(libraryStore.getState().evicted).toBe(false);
    });
  });
});
