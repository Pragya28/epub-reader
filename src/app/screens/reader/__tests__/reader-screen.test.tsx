import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReaderScreen } from "../reader-screen";
import { readerStore } from "@/features/reader/store/reader-store";
import type { ParsedBook } from "@/services/epub/epub-types";

vi.mock("@/shared/logger/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

const loadReaderBookMock = vi.fn((_bookId: string) => Promise.resolve());
vi.mock("@/features/reader/actions/load-reader-book", () => ({
  loadReaderBook: (bookId: string) => loadReaderBookMock(bookId),
}));

vi.mock("@/features/reader/hooks/use-reader-engine", () => ({
  useReaderEngine: vi.fn(() => ({ jumpBack: vi.fn() })),
}));

const jumpToTocItemMock = vi.fn();
vi.mock("@/features/reader/actions/jump-to-toc-item", () => ({
  jumpToTocItem: (...args: unknown[]) => jumpToTocItemMock(...args),
}));

function renderReaderScreen(bookId = "book-1") {
  return render(
    <MemoryRouter initialEntries={[`/reader/${bookId}`]}>
      <Routes>
        <Route path="/reader/:bookId" element={<ReaderScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockParsedBook: ParsedBook = {
  metadata: {
    title: "Test Book",
    author: "Test Author",
    language: "en",
    description: null,
  },
  chapters: [
    {
      id: "ch0",
      href: "text/ch0.xhtml",
      content: "<p>Chapter 0</p>",
      stylesheets: [],
      assetMap: new Map(),
    },
  ],
  toc: [],
  stylesheets: [],
  loadChapter: (index: number) =>
    Promise.resolve(mockParsedBook.chapters[index]!),
};

const mockThreeChapterBook: ParsedBook = {
  ...mockParsedBook,
  chapters: [0, 1, 2].map((i) => ({
    id: `ch${i}`,
    href: `text/ch${i}.xhtml`,
    content: `<p>Chapter ${i}</p>`,
    stylesheets: [],
    assetMap: new Map(),
  })),
  loadChapter: (index: number) =>
    Promise.resolve(mockThreeChapterBook.chapters[index]!),
};

describe("ReaderScreen", () => {
  beforeEach(() => {
    readerStore.getState().reset();
    loadReaderBookMock.mockClear();
    jumpToTocItemMock.mockClear();
  });

  it("shows a loading state while the book is loading", () => {
    readerStore.setState({ isLoading: true });

    renderReaderScreen();

    expect(screen.getByText("Loading reader...")).toBeInTheDocument();
  });

  it("shows the error panel with retry and back-to-library actions", async () => {
    readerStore.setState({ isLoading: false, error: "Something bad" });

    renderReaderScreen();

    expect(screen.getByText("Error loading book")).toBeInTheDocument();
    expect(screen.getByText("Something bad")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(loadReaderBookMock).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Back to library" }),
    ).toBeInTheDocument();
  });

  it("renders the book title, author, and chapter count once loaded", () => {
    readerStore.setState({
      isLoading: false,
      error: null,
      readerDocument: {
        book: {
          id: "book-1",
          title: "Test Book",
          author: "Test Author",
        } as never,
        file: new Blob(),
      },
      parsedBook: mockParsedBook,
      currentChapterIndex: 0,
    });

    renderReaderScreen();

    expect(screen.getByText("Test Book")).toBeInTheDocument();
    expect(screen.getByText("Test Author")).toBeInTheDocument();
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
  });

  it("calls loadReaderBook on mount for the given bookId", () => {
    readerStore.setState({ isLoading: true });

    renderReaderScreen("book-42");

    expect(loadReaderBookMock).toHaveBeenCalledWith("book-42");
  });

  it("falls back to a book ornament once the cover check resolves with no cover", async () => {
    readerStore.setState({ isLoading: true });

    const { container } = renderReaderScreen("book-no-cover");

    await waitFor(() => {
      expect(container.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("prev/next chapter controls", () => {
    function setLoadedAt(chapterIndex: number) {
      readerStore.setState({
        isLoading: false,
        error: null,
        readerDocument: {
          book: {
            id: "book-1",
            title: "Test Book",
            author: "Test Author",
          } as never,
          file: new Blob(),
        },
        parsedBook: mockThreeChapterBook,
        currentChapterIndex: chapterIndex,
      });
    }

    it("disables the previous button on the first chapter", () => {
      setLoadedAt(0);
      renderReaderScreen();

      expect(
        screen.getByRole("button", { name: "Previous chapter" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Next chapter" }),
      ).not.toBeDisabled();
    });

    it("disables the next button on the last chapter", () => {
      setLoadedAt(2);
      renderReaderScreen();

      expect(
        screen.getByRole("button", { name: "Next chapter" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Previous chapter" }),
      ).not.toBeDisabled();
    });

    it("jumps to the next chapter when clicked", async () => {
      setLoadedAt(1);
      const user = userEvent.setup();
      renderReaderScreen();

      await user.click(screen.getByRole("button", { name: "Next chapter" }));

      expect(jumpToTocItemMock).toHaveBeenCalledWith(
        expect.objectContaining({ chapterIndex: 2 }),
        expect.anything(),
        expect.anything(),
        mockThreeChapterBook,
      );
    });

    it("jumps to the previous chapter when clicked", async () => {
      setLoadedAt(1);
      const user = userEvent.setup();
      renderReaderScreen();

      await user.click(
        screen.getByRole("button", { name: "Previous chapter" }),
      );

      expect(jumpToTocItemMock).toHaveBeenCalledWith(
        expect.objectContaining({ chapterIndex: 0 }),
        expect.anything(),
        expect.anything(),
        mockThreeChapterBook,
      );
    });
  });
});
