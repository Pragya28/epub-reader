import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LibraryScreen } from "@/app/screens/library-screen";
import type { StoredBook } from "@/services/storage/storage-types";

vi.mock("@/features/library/actions/load-library", () => ({
  loadLibrary: vi.fn(),
}));

import { loadLibrary } from "@/features/library/actions/load-library";
import { libraryStore } from "../../store/library-store";
import { resetLibraryStore } from "@/tests/utils/reset-store";

const mockedLoadLibrary = vi.mocked(loadLibrary);

describe("LibraryScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLibraryStore();
  });

  const renderScreen = () => {
    return render(
      <MemoryRouter>
        <LibraryScreen />
      </MemoryRouter>,
    );
  };

  it("shows empty state when no books exist", () => {
    renderScreen();

    expect(screen.getByText(/your library is empty/i)).toBeInTheDocument();
  });

  it("renders books from store", () => {
    const books: StoredBook[] = [
      {
        id: "book-1",
        fileHash: "hash-1",
        title: "Moby Dick",
        author: "Herman Melville",
        language: "en",
        createdAt: 1,
      },
    ];

    libraryStore.setState({
      books,
      isLoading: false,
      error: null,
    });

    renderScreen();

    expect(screen.getAllByText("Moby Dick").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Herman Melville").length).toBeGreaterThan(0);
  });

  it("loads books on mount", async () => {
    const books: StoredBook[] = [
      {
        id: "book-1",
        fileHash: "hash-1",
        title: "Loaded Book",
        author: "Author",
        language: "en",
        createdAt: 1,
      },
    ];

    mockedLoadLibrary.mockImplementation(async () => {
      libraryStore.getState().setBooks(books);
    });

    renderScreen();

    const loadedBooks = await screen.findAllByText("Loaded Book");

    expect(loadedBooks.length).toBeGreaterThan(0);
  });

  it("shows loading state", () => {
    libraryStore.setState({
      books: [],
      isLoading: true,
      error: null,
    });

    renderScreen();

    expect(screen.getByText(/loading your library/i)).toBeInTheDocument();
  });

  it("shows error state", () => {
    libraryStore.setState({
      books: [],
      isLoading: false,
      error: "Database failure",
    });

    renderScreen();

    expect(screen.getByText("Failed to load library")).toBeInTheDocument();

    expect(screen.getByText("Database failure")).toBeInTheDocument();
  });
});
