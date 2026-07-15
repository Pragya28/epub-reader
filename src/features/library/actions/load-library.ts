import {
  getAllBooks,
  getBookCoverUrl,
} from "@/services/storage/book-repository";

import { libraryStore } from "../store/library-store";

export async function loadLibrary() {
  const store = libraryStore.getState();

  try {
    const books = await getAllBooks();

    const booksWithProgress = await Promise.all(
      books.map(async (book) => ({
        ...book,
        coverBg: await getBookCoverUrl(book.id),
      })),
    );

    store.setBooks(booksWithProgress);
  } catch (error) {
    store.setError(`Failed to load library: ${error}`);
  } finally {
    store.setLoading(false);
  }
}
