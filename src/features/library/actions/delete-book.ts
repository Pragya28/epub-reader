import { logger as rootLogger } from "@/shared/logger/logger";
import { deleteIndex } from "@/services/search/search-index";
import { deleteChapterText } from "@/services/search/chapter-text";
import { deleteBook as deleteBookFromStorage } from "@/services/storage/book-repository";
import { deleteMembersForBook } from "@/services/storage/groupings";
import { libraryStore } from "../store/library-store";

const logger = rootLogger.child("delete-book");

export async function deleteBook(bookId: string): Promise<void> {
  await deleteBookFromStorage(bookId);

  // The book row, file and cover are gone — reflect that in the UI now,
  // rather than waiting on the best-effort cleanup below (search index,
  // chapter text, grouping membership). That cleanup can't be made fully
  // atomic with the delete above (separate tables/stores, no shared
  // transaction), so ordering it either way only narrows, not closes, the
  // window for a crash or a rejected write to leave a dependent row
  // pointing at a bookId no longer in `books` — logging failures here at
  // least surfaces that instead of losing it silently.
  libraryStore.getState().removeBook(bookId);

  const results = await Promise.allSettled([
    deleteIndex(bookId),
    deleteChapterText(bookId),
    deleteMembersForBook(bookId),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error(`dependent-row cleanup failed for ${bookId}`, result.reason);
    }
  }
}
