import { beforeEach, describe, expect, it } from "vitest";

import {
  getAllBooks,
  getBookFile,
  saveBookFile,
  saveBookMetadata,
} from "../book-repository";

import { resetTestDb } from "@/tests/utils/reset-test-db";

describe("book repository", () => {
  beforeEach(resetTestDb);

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
});
