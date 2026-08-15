import { deleteIndex } from "@/services/search/search-index";
import { deleteChapterText } from "@/services/search/chapter-text";
import { deleteBook as deleteBookFromStorage } from "@/services/storage/book-repository";
import { deleteMembersForBook } from "@/services/storage/groupings";
import { libraryStore } from "../store/library-store";

export async function deleteBook(bookId: string): Promise<void> {
  await deleteBookFromStorage(bookId);
  await deleteIndex(bookId);
  await deleteChapterText(bookId);
  await deleteMembersForBook(bookId);
  libraryStore.getState().removeBook(bookId);
}
