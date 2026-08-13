import { db } from "@/services/storage/db";
import type { StoredChapterText } from "@/services/storage/storage-types";

export async function putChapterTexts(
  entries: StoredChapterText[],
): Promise<void> {
  await db.chapterText.bulkPut(entries);
}

export async function getChapterText(
  bookId: string,
  chapter: number,
): Promise<StoredChapterText | undefined> {
  return db.chapterText.get([bookId, chapter]);
}

export async function deleteChapterText(bookId: string): Promise<void> {
  await db.chapterText.where({ bookId }).delete();
}
