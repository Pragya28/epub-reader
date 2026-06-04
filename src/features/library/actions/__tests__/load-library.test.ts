import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/storage/book-repository", () => ({
  getAllBooks: vi.fn(),
}));

import { getAllBooks } from "@/services/storage/book-repository";
import { loadLibrary } from "../load-library";
import { libraryStore } from "../../store/library-store";
import { resetLibraryStore } from "@/tests/utils/reset-store";
import type { StoredBook } from "@/services/storage/storage-types";

const mockedGetAllBooks = vi.mocked(getAllBooks);

describe("loadLibrary", () => {
  beforeEach(() => {
    resetLibraryStore();
    vi.clearAllMocks();
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
});
