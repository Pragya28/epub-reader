import { db } from "@/services/storage/db";
import type { StoredSearchIndexEntry } from "@/services/storage/storage-types";

export async function hasIndex(bookId: string): Promise<boolean> {
  const existing = await db.searchIndex.where({ bookId }).first();
  return existing !== undefined;
}

export async function putIndexEntries(
  entries: StoredSearchIndexEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  const bookIds = [...new Set(entries.map((entry) => entry.bookId))];

  // Atomic replace. bulkAdd is append-only (autoincrement id, no uniqueness on
  // {word,bookId,chapter}), so without clearing the book's existing rows a
  // second buildIndex — the lazy backfill racing an import's fire-and-forget
  // build, or two concurrent searches — silently doubles every row. The
  // transaction also serializes those concurrent builds.
  await db.transaction("rw", db.searchIndex, async () => {
    await db.searchIndex.where("bookId").anyOf(bookIds).delete();
    await db.searchIndex.bulkAdd(entries);
  });
}

export async function deleteIndex(bookId: string): Promise<void> {
  await db.searchIndex.where({ bookId }).delete();
}

export async function findMatches(
  word: string,
  bookId?: string,
): Promise<StoredSearchIndexEntry[]> {
  const matches = await db.searchIndex.where({ word }).toArray();
  return bookId ? matches.filter((entry) => entry.bookId === bookId) : matches;
}
