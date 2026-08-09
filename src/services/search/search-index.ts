import { db } from "@/services/storage/db";
import type { StoredSearchIndexEntry } from "@/services/storage/storage-types";

export async function hasIndex(bookId: string): Promise<boolean> {
  const existing = await db.searchIndex.where({ bookId }).first();
  return existing !== undefined;
}

export async function putIndexEntries(
  entries: StoredSearchIndexEntry[],
): Promise<void> {
  await db.searchIndex.bulkAdd(entries);
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
