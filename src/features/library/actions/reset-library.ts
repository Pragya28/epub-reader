import { db } from "@/services/storage/db";
import { revokeCoverUrl } from "@/services/storage/cover-cache";
import { deleteOpfsFile } from "@/services/storage/opfs-files";
import { pwaStore } from "@/features/pwa/store/pwa-store";
import { libraryStore } from "../store/library-store";

/**
 * Wipes the library: every table, every OPFS file, cached cover URLs, and
 * the in-memory library stores. Preferences and PWA/install flags survive
 * (except `hadBooks`) — this resets the library, not the app. `hadBooks` is
 * cleared so the empty library reads as first-run, not browser eviction.
 */
export async function resetLibrary(): Promise<void> {
  const books = await db.books.toArray();

  // OPFS lives outside Dexie's transaction scope — do it first, per book,
  // while we still have the ids. deleteOpfsFile already fails soft.
  for (const book of books) {
    revokeCoverUrl(book.id);
    await deleteOpfsFile(book.id);
  }

  await db.transaction(
    "rw",
    [
      db.books,
      db.bookFiles,
      db.bookCovers,
      db.searchIndex,
      db.chapterText,
      db.groupings,
      db.groupingMembers,
    ],
    async () => {
      await Promise.all([
        db.books.clear(),
        db.bookFiles.clear(),
        db.bookCovers.clear(),
        db.searchIndex.clear(),
        db.chapterText.clear(),
        db.groupings.clear(),
        db.groupingMembers.clear(),
      ]);
    },
  );

  libraryStore.getState().setBooks([]);
  libraryStore.getState().setEvicted(false);
  pwaStore.getState().setHadBooks(false);
}
