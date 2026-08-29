import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadReaderBook } from "../load-reader-book";
import { readerStore } from "../../store/reader-store";
import { getBookWithFile } from "@/services/storage/book-repository";
import { EpubParser } from "@/services/epub/epub-parser";
import type { StoredBook } from "@/services/storage/storage-types";

vi.mock("@/services/storage/book-repository", () => ({
  getBookWithFile: vi.fn(),
}));

const parseBook = vi.fn();

vi.mock("@/services/epub/epub-parser", () => ({
  EpubParser: vi.fn().mockImplementation(function () {
    return {
      parseBook,
    };
  }),
}));

const storedBook: StoredBook = {
  id: "book-1",
  title: "Test Book",
  author: "Test Author",
  language: "en",
  createdAt: Date.now(),
  fileHash: "abc123",
};

describe("loadReaderBook", () => {
  const readerDocument = {
    book: storedBook,
    file: new Blob(["epub"]),
  };

  const parsedBook = {
    metadata: {
      title: "Book",
      author: "Author",
    },
    chapters: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    readerStore.setState({
      isLoading: false,
      error: "old error",
      readerDocument: null,
      parsedBook: null,
    });
  });

  it("loads and parses a book", async () => {
    vi.mocked(getBookWithFile).mockResolvedValue(readerDocument);
    parseBook.mockResolvedValue(parsedBook);

    await loadReaderBook("book-1");

    expect(getBookWithFile).toHaveBeenCalledWith("book-1");
    expect(parseBook).toHaveBeenCalledWith(readerDocument.file);

    const state = readerStore.getState();

    expect(state.readerDocument).toBe(readerDocument);
    expect(state.parsedBook).toBe(parsedBook);
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("creates a new parser", async () => {
    vi.mocked(getBookWithFile).mockResolvedValue(readerDocument);
    parseBook.mockResolvedValue(parsedBook);

    await loadReaderBook("book-1");

    expect(EpubParser).toHaveBeenCalledTimes(1);
  });

  it("sets loading while work is in progress", async () => {
    let resolve!: (value: typeof readerDocument) => void;

    vi.mocked(getBookWithFile).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    const promise = loadReaderBook("book-1");

    expect(readerStore.getState().isLoading).toBe(true);

    resolve(readerDocument);
    parseBook.mockResolvedValue(parsedBook);

    await promise;

    expect(readerStore.getState().isLoading).toBe(false);
  });

  it("throws when the book's file is missing", async () => {
    vi.mocked(getBookWithFile).mockResolvedValue(null);

    await expect(loadReaderBook("book-1")).rejects.toThrow(/file is missing/);

    expect(readerStore.getState().error).toMatch(/file is missing/);
    expect(parseBook).not.toHaveBeenCalled();
  });

  it("rethrows repository errors", async () => {
    const error = new Error("Database failed");

    vi.mocked(getBookWithFile).mockRejectedValue(error);

    await expect(loadReaderBook("book-1")).rejects.toThrow(error);

    expect(readerStore.getState().error).toBe("Database failed");
  });

  it("rethrows parser errors", async () => {
    const error = new Error("Invalid EPUB");

    vi.mocked(getBookWithFile).mockResolvedValue(readerDocument);
    parseBook.mockRejectedValue(error);

    await expect(loadReaderBook("book-1")).rejects.toThrow(error);

    expect(readerStore.getState().error).toBe("Invalid EPUB");
  });

  it("uses a generic message for non-Error values", async () => {
    vi.mocked(getBookWithFile).mockRejectedValue("boom");

    await expect(loadReaderBook("book-1")).rejects.toBe("boom");

    expect(readerStore.getState().error).toBe("Failed to load book");
  });

  it("sets readerDocument (for the loading skeleton) but not parsedBook when parsing fails", async () => {
    vi.mocked(getBookWithFile).mockResolvedValue(readerDocument);
    parseBook.mockRejectedValue(new Error("Parse failed"));

    await expect(loadReaderBook("book-1")).rejects.toThrow();

    const state = readerStore.getState();

    expect(state.readerDocument).toEqual(readerDocument);
    expect(state.parsedBook).toBeNull();
  });

  it("seeds currentChapterIndex from jumpChapterIndex, overriding saved progress", async () => {
    const bookWithProgress: StoredBook = {
      ...storedBook,
      progress: {
        chapterIndex: 1,
        totalChapters: 5,
        scrollFraction: 0.5,
        atDocumentEnd: false,
        percent: 20,
        updatedAt: Date.now(),
      },
    };

    vi.mocked(getBookWithFile).mockResolvedValue({
      book: bookWithProgress,
      file: new Blob(["epub"]),
    });
    parseBook.mockResolvedValue({
      ...parsedBook,
      chapters: [{}, {}, {}, {}, {}],
    });

    await loadReaderBook("book-1", 3);

    expect(readerStore.getState().currentChapterIndex).toBe(3);
  });

  it("falls back to saved progress when jumpChapterIndex is out of range", async () => {
    const bookWithProgress: StoredBook = {
      ...storedBook,
      progress: {
        chapterIndex: 1,
        totalChapters: 5,
        scrollFraction: 0.5,
        atDocumentEnd: false,
        percent: 20,
        updatedAt: Date.now(),
      },
    };

    vi.mocked(getBookWithFile).mockResolvedValue({
      book: bookWithProgress,
      file: new Blob(["epub"]),
    });
    parseBook.mockResolvedValue({
      ...parsedBook,
      chapters: [{}, {}, {}, {}, {}],
    });

    await loadReaderBook("book-1", 99);

    expect(readerStore.getState().currentChapterIndex).toBe(1);
  });
});
