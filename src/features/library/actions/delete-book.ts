import { deleteIndex } from "@/services/search/search-index";
import { deleteChapterText } from "@/services/search/chapter-text";
import { deleteBook as deleteBookFromStorage } from "@/services/storage/book-repository";
import { deleteMembersForBook } from "@/services/storage/groupings";
import { libraryStore } from "../store/library-store";

export async function deleteBook(bookId: string): Promise<void> {
  await deleteBookFromStorage(bookId);

  // The book row, file and cover are gone — reflect that in the UI now. The
  // rest is best-effort cleanup of dependent rows (search index, chapter text,
  // grouping membership); a failure there must not resurrect the card, leave
  // the user without feedback, or block the deletion.
  libraryStore.getState().removeBook(bookId);

  await Promise.allSettled([
    deleteIndex(bookId),
    deleteChapterText(bookId),
    deleteMembersForBook(bookId),
  ]);
}
