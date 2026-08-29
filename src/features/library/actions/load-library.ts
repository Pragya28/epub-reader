import {
  getAllBooks,
  getBookCoverUrl,
} from "@/services/storage/book-repository";

import { libraryStore } from "../store/library-store";
import { pwaStore } from "@/features/pwa/store/pwa-store";

export async function loadLibrary() {
  const store = libraryStore.getState();

  try {
    store.setLoading(true);
    store.setError(null);

    const books = await getAllBooks();

    if (books.length > 0) {
      // Known-good library — clear any stale eviction flag and mark the
      // user as past the first-run install gate (covers users who imported
      // before the install banner existed).
      store.setEvicted(false);
      pwaStore.getState().setHadBooks(true);
      pwaStore.getState().setFirstImportDone(true);
    } else if (pwaStore.getState().hadBooks) {
      // The library had books before and is now empty: the browser evicted
      // this origin's storage. Surface it rather than showing a blank
      // first-run empty state.
      store.setEvicted(true);
    }

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
