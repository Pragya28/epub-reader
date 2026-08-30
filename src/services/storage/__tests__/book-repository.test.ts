import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteBook,
  getAllBooks,
  getBookCover,
  getBookCoverUrl,
  saveBookCover,
  saveBookMetadata,
  saveImportedBook,
} from "../book-repository";
import { getBookFile, saveBookFile } from "../book-files";

import { resetTestDb } from "@/tests/utils/reset-test-db";
import { clearCoverCache } from "../cover-cache";

describe("book repository", () => {
  beforeEach(async () => {
    await resetTestDb();
    clearCoverCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves metadata", async () => {
    await saveBookMetadata({
      id: "1",
      title: "Test Book",
      author: "Author",
      language: "en",
      createdAt: 1,
      fileHash: "hash-1",
    });

    const books = await getAllBooks();

    expect(books).toHaveLength(1);

    expect(books[0]).toMatchObject({
      id: "1",
      title: "Test Book",
      author: "Author",
      language: "en",
      fileHash: "hash-1",
    });
  });

  it("stores epub file blob", async () => {
    const blob = new Blob(["epub"]);

    await saveBookFile("1", blob);

    const stored = await getBookFile("1");

    expect(stored).toBeDefined();
    expect(stored?.bookId).toBe("1");
  });

  it("returns newest books first", async () => {
    await saveBookMetadata({
      id: "1",
      title: "Old",
      createdAt: 1,
      fileHash: "hash-old",
    });

    await saveBookMetadata({
      id: "2",
      title: "New",
      createdAt: 2,
      fileHash: "hash-new",
    });

    const books = await getAllBooks();

    expect(books[0].title).toBe("New");
    expect(books[0].fileHash).toBe("hash-new");
  });

  it("stores unique file hashes", async () => {
    await saveBookMetadata({
      id: "1",
      title: "Book One",
      createdAt: 1,
      fileHash: "hash-1",
    });

    await saveBookMetadata({
      id: "2",
      title: "Book Two",
      createdAt: 2,
      fileHash: "hash-2",
    });

    const books = await getAllBooks();

    expect(books[0].fileHash).not.toBe(books[1].fileHash);
  });

  it("rejects duplicate file hashes", async () => {
    await saveBookMetadata({
      id: "1",
      title: "Book One",
      createdAt: 1,
      fileHash: "duplicate-hash",
    });

    await expect(
      saveBookMetadata({
        id: "2",
        title: "Book Two",
        createdAt: 2,
        fileHash: "duplicate-hash",
      }),
    ).rejects.toThrow();
  });

  it("stores cover blob", async () => {
    const cover = new Blob(["cover"]);

    await saveBookCover("1", cover);

    const stored = await getBookCover("1");

    expect(stored).toBeDefined();
    expect(stored?.bookId).toBe("1");
    expect(stored?.cover).toBeDefined();
  });

  it("stores metadata, epub and cover in a single transaction", async () => {
    const file = new Blob(["epub"]);
    const cover = new Blob(["cover"]);

    await saveImportedBook({
      metadata: {
        id: "1",
        title: "Test Book",
        author: "Author",
        language: "en",
        createdAt: 1,
        fileHash: "hash-1",
      },
      file,
      cover,
    });

    const books = await getAllBooks();
    const storedFile = await getBookFile("1");
    const storedCover = await getBookCover("1");

    expect(books).toHaveLength(1);

    expect(storedFile).toBeDefined();
    expect(storedFile?.bookId).toBe("1");
    expect(storedFile?.file).toBeDefined();

    expect(storedCover).toBeDefined();
    expect(storedCover?.bookId).toBe("1");
    expect(storedCover?.cover).toBeDefined();
  });

  it("stores imported book without cover", async () => {
    const file = new Blob(["epub"]);

    await saveImportedBook({
      metadata: {
        id: "1",
        title: "Test Book",
        createdAt: 1,
        fileHash: "hash-1",
      },
      file,
    });

    expect(await getBookCover("1")).toBeUndefined();
  });

  it("returns blob url for stored cover", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");

    const cover = new Blob(["cover"]);

    await saveBookCover("1", cover);

    const url = await getBookCoverUrl("1");

    expect(url).toBe("blob:test");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    const arg = vi.mocked(URL.createObjectURL).mock.calls[0][0];

    expect(arg).toBeDefined();
  });

  it("reuses cached blob url", async () => {
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");

    const cover = new Blob(["cover"]);

    await saveBookCover("1", cover);

    const first = await getBookCoverUrl("1");
    const second = await getBookCoverUrl("1");

    expect(first).toBe("blob:test");
    expect(second).toBe("blob:test");

    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("deletes a book's file, cover, and metadata", async () => {
    const file = new Blob(["epub"]);
    const cover = new Blob(["cover"]);

    await saveImportedBook({
      metadata: {
        id: "1",
        title: "Test Book",
        createdAt: 1,
        fileHash: "hash-1",
      },
      file,
      cover,
    });

    await deleteBook("1");

    expect(await getBookFile("1")).toBeUndefined();
    expect(await getBookCover("1")).toBeUndefined();
    expect(await getAllBooks()).toHaveLength(0);
  });

  it("deleting a book with no cover doesn't throw", async () => {
    await saveBookMetadata({
      id: "1",
      title: "Test Book",
      createdAt: 1,
      fileHash: "hash-1",
    });

    await expect(deleteBook("1")).resolves.not.toThrow();
    expect(await getAllBooks()).toHaveLength(0);
  });
});
