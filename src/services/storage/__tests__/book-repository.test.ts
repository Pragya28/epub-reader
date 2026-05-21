import { beforeEach, describe, expect, it } from "vitest";

import { db } from "../db";

import {
  getAllBooks,
  getBookFile,
  saveBookFile,
  saveBookMetadata,
} from "../book-repository";

describe("book repository", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("saves metadata", async () => {
    await saveBookMetadata({
      id: "1",
      title: "Test Book",
      author: "Author",
      language: "en",
      createdAt: 1,
    });

    const books = await getAllBooks();

    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("Test Book");
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
    });

    await saveBookMetadata({
      id: "2",
      title: "New",
      createdAt: 2,
    });

    const books = await getAllBooks();

    expect(books[0].title).toBe("New");
  });
});
