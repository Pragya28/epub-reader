import Dexie, { type Table } from "dexie";
import type {
  StoredBook,
  StoredBookCover,
  StoredBookFile,
} from "./storage-types";

class LibruneDB extends Dexie {
  books!: Table<StoredBook>;
  bookFiles!: Table<StoredBookFile>;
  bookCovers!: Table<StoredBookCover>;

  constructor() {
    super("librune-db");

    this.version(2).stores({
      books: "id, title, author, createdAt, &fileHash",
      bookFiles: "bookId",
      bookCovers: "bookId",
    });
  }
}

export const db = new LibruneDB();
