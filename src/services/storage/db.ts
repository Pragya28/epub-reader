import Dexie, { type Table } from "dexie";
import type { StoredBook, StoredBookFile } from "./storage-types";

class LibruneDB extends Dexie {
  books!: Table<StoredBook>;
  bookFiles!: Table<StoredBookFile>;

  constructor() {
    super("librune-db");

    this.version(2).stores({
      books: "id, title, author, createdAt",
      bookFiles: "bookId",
    });
  }
}

export const db = new LibruneDB();
