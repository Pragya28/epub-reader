import { db } from "@/services/storage/db";
import {
  addMember,
  deleteGrouping,
  getGrouping,
  isCollection,
  putGrouping,
  removeMember,
} from "@/services/storage/groupings";
import { createId } from "@/utils/create-id";

async function requireCollection(groupingId: string) {
  const grouping = await getGrouping(groupingId);
  if (!grouping || !isCollection(grouping)) {
    throw new Error(`${groupingId} is not a collection`);
  }
  return grouping;
}

export async function createCollection(name: string): Promise<string> {
  const id = createId();
  const now = Date.now();
  await putGrouping({
    id,
    type: "collection",
    name,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function renameCollection(
  groupingId: string,
  name: string,
): Promise<void> {
  const grouping = await requireCollection(groupingId);
  await putGrouping({ ...grouping, name, updatedAt: Date.now() });
}

/** Cascades membership cleanup — a series loses no rows this way since it
 * has no delete action of its own (see isCollection's guard). */
export async function deleteCollection(groupingId: string): Promise<void> {
  await requireCollection(groupingId);
  await db.groupingMembers.where({ groupingId }).delete();
  await deleteGrouping(groupingId);
}

/** `order` is assigned as the next sequential index so collections sort by
 * add-order via the same GroupingMember.order field series already uses —
 * no separate ordering mechanism, no manual reordering (out of scope). */
export async function addBookToCollection(
  groupingId: string,
  bookId: string,
): Promise<void> {
  await requireCollection(groupingId);
  const count = await db.groupingMembers.where({ groupingId }).count();
  await addMember(groupingId, bookId, count);
}

export async function removeBookFromCollection(
  groupingId: string,
  bookId: string,
): Promise<void> {
  await requireCollection(groupingId);
  await removeMember(groupingId, bookId);
}
