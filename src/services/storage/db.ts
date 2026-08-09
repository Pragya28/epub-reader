import Dexie, { type Table } from "dexie";
import type {
  StoredBook,
  StoredBookCover,
  StoredBookFile,
  StoredSearchIndexEntry,
} from "./storage-types";

class LibruneDB extends Dexie {
  books!: Table<StoredBook>;
  bookFiles!: Table<StoredBookFile>;
  bookCovers!: Table<StoredBookCover>;
  searchIndex!: Table<StoredSearchIndexEntry>;

  constructor() {
    super("librune-db");

    this.version(2).stores({
      books: "id, title, author, createdAt, &fileHash",
      bookFiles: "bookId",
      bookCovers: "bookId",
    });

    // v3: adds an index on the nested `progress.updatedAt` field so
    // "most recently read" queries (continue-reading) don't require a
    // full table scan. No data migration needed — `progress` is optional
    // and existing rows simply won't be indexed until first updated.
    this.version(3).stores({
      books: "id, title, author, createdAt, &fileHash, progress.updatedAt",
      bookFiles: "bookId",
      bookCovers: "bookId",
    });

    // v4: adds the full-text search index (Sprint 6). One row per
    // {word, bookId, chapter} occurrence; `word` and `bookId` indexed so a
    // query can look up matches directly instead of scanning the table.
    this.version(4).stores({
      books: "id, title, author, createdAt, &fileHash, progress.updatedAt",
      bookFiles: "bookId",
      bookCovers: "bookId",
      searchIndex: "++id, word, bookId",
    });
  }
}

export const db = new LibruneDB();
