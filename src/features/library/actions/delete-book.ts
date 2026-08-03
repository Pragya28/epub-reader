import { deleteBook as deleteBookFromStorage } from "@/services/storage/book-repository";
import { libraryStore } from "../store/library-store";

export async function deleteBook(bookId: string): Promise<void> {
  await deleteBookFromStorage(bookId);
  libraryStore.getState().removeBook(bookId);
}
