import { db } from "@/services/storage/db";
import { getBook } from "@/services/storage/book-repository";
import { createId } from "@/utils/create-id";
import type {
  Grouping,
  GroupingMember,
} from "@/services/storage/storage-types";

export async function getGrouping(id: string): Promise<Grouping | undefined> {
  return db.groupings.get(id);
}

export async function listGroupings(
  type?: Grouping["type"],
): Promise<Grouping[]> {
  const all = await db.groupings.toArray();
  return type ? all.filter((grouping) => grouping.type === type) : all;
}

export async function putGrouping(grouping: Grouping): Promise<void> {
  await db.groupings.put(grouping);
}

export async function deleteGrouping(id: string): Promise<void> {
  await db.groupings.delete(id);
}

export async function getMembersForBook(
  bookId: string,
): Promise<GroupingMember[]> {
  return db.groupingMembers.where({ bookId }).toArray();
}

export async function getMembersForGrouping(
  groupingId: string,
): Promise<GroupingMember[]> {
  return db.groupingMembers.where({ groupingId }).toArray();
}

export async function addMember(
  groupingId: string,
  bookId: string,
  order: number | null = null,
): Promise<void> {
  await db.groupingMembers.put({ groupingId, bookId, order });
}

export async function removeMember(
  groupingId: string,
  bookId: string,
): Promise<void> {
  await db.groupingMembers.delete([groupingId, bookId]);
}

/**
 * The one guard both the collection action layer (Day 3) and any UI
 * (Day 4/5) use to keep series read-only — no renameSeries/deleteSeries
 * exists, but this makes a future caller mistake a thrown error instead
 * of a silent series mutation.
 */
export function isCollection(grouping: Grouping): boolean {
  return grouping.type === "collection";
}

export async function hasSeriesMembership(bookId: string): Promise<boolean> {
  const members = await getMembersForBook(bookId);
  if (members.length === 0) return false;

  const groupings = await Promise.all(
    members.map((member) => getGrouping(member.groupingId)),
  );
  return groupings.some((grouping) => grouping?.type === "series");
}

/**
 * Upserts series membership for a book: reuses an existing series
 * grouping matched case-insensitively by name, or creates one. Called
 * from import (new books) and the backfill (pre-existing books) — see
 * ensureSeriesGroupings.
 */
export async function upsertSeriesMembership(
  bookId: string,
  seriesName: string,
  seriesIndex: number | null,
): Promise<void> {
  const existing = await listGroupings("series");
  const match = existing.find(
    (grouping) => grouping.name.toLowerCase() === seriesName.toLowerCase(),
  );

  const groupingId = match?.id ?? createId();

  if (!match) {
    await putGrouping({
      id: groupingId,
      type: "series",
      name: seriesName,
      createdAt: Date.now(),
    });
  }

  await addMember(groupingId, bookId, seriesIndex);
}

/**
 * Removes every grouping membership for a deleted book. A series
 * grouping that loses its last member is deleted too — a series only
 * exists because books with that metadata exist, so an empty one is
 * meaningless. Collections are never auto-deleted this way; a
 * user-created shelf is deliberately kept around empty.
 */
export async function deleteMembersForBook(bookId: string): Promise<void> {
  const members = await db.groupingMembers.where({ bookId }).toArray();
  const groupingIds = members.map((member) => member.groupingId);

  await db.groupingMembers.where({ bookId }).delete();

  for (const groupingId of groupingIds) {
    const grouping = await db.groupings.get(groupingId);
    if (grouping?.type !== "series") continue;

    const remaining = await db.groupingMembers.where({ groupingId }).count();
    if (remaining === 0) {
      await db.groupings.delete(groupingId);
    }
  }
}

/**
 * Backfills series membership for books that predate this schema (or
 * otherwise lost their membership row) — checked via a cheap
 * hasSeriesMembership lookup per book, deriving from the seriesName
 * already cached on StoredBook rather than re-reading/re-parsing the
 * EPUB file. Mirrors ensureIndexesForBooks's shape (Sprint 6).
 */
export async function ensureSeriesGroupings(bookIds: string[]): Promise<void> {
  await Promise.all(
    bookIds.map(async (bookId) => {
      if (await hasSeriesMembership(bookId)) return;

      const book = await getBook(bookId);
      if (!book?.seriesName) return;

      await upsertSeriesMembership(
        bookId,
        book.seriesName,
        book.seriesIndex ?? null,
      );
    }),
  );
}
