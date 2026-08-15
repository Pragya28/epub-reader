import Dexie, { type Table } from "dexie";
import type {
  Grouping,
  GroupingMember,
  StoredBook,
  StoredBookCover,
  StoredBookFile,
  StoredChapterText,
  StoredSearchIndexEntry,
} from "./storage-types";

class LibruneDB extends Dexie {
  books!: Table<StoredBook>;
  bookFiles!: Table<StoredBookFile>;
  bookCovers!: Table<StoredBookCover>;
  searchIndex!: Table<StoredSearchIndexEntry>;
  chapterText!: Table<StoredChapterText>;
  groupings!: Table<Grouping>;
  groupingMembers!: Table<GroupingMember>;

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

    // v5: caches each chapter's plain text + TOC label at index-build time
    // (Sprint 6B), so search result rows don't re-fetch and re-unzip the
    // EPUB per row just to build a snippet. Compound primary key so a
    // lookup by (bookId, chapter) needs no secondary index; `bookId` alone
    // is indexed too so a book's rows can be deleted in one query, same
    // shape as searchIndex. No data migration — existing books simply miss
    // the cache until reindexed, and the read path falls back to parsing.
    this.version(5).stores({
      books: "id, title, author, createdAt, &fileHash, progress.updatedAt",
      bookFiles: "bookId",
      bookCovers: "bookId",
      searchIndex: "++id, word, bookId",
      chapterText: "[bookId+chapter], bookId",
    });

    // v6: adds series/collection grouping tables (Sprint 7). One `groupings`
    // row per series or user collection, discriminated by `type`; membership
    // lives in a separate `groupingMembers` join table so a book can belong
    // to many collections. `order` carries series reading order and is
    // unused for collections. No data migration — existing books simply
    // have no grouping rows until series backfill runs or a user creates a
    // collection.
    this.version(6).stores({
      books: "id, title, author, createdAt, &fileHash, progress.updatedAt",
      bookFiles: "bookId",
      bookCovers: "bookId",
      searchIndex: "++id, word, bookId",
      chapterText: "[bookId+chapter], bookId",
      groupings: "id, type, name",
      groupingMembers: "[groupingId+bookId], groupingId, bookId",
    });
  }
}

export const db = new LibruneDB();
