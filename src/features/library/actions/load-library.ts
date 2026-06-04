import { getAllBooks } from "@/services/storage/book-repository";

import { libraryStore } from "../store/library-store";

export async function loadLibrary() {
  const store = libraryStore.getState();

  try {
    store.setLoading(true);
    const books = await getAllBooks();
    store.setBooks(books);
  } catch (error) {
    store.setError(`Failed to load library: ${error}`);
  } finally {
    store.setLoading(false);
  }
}
