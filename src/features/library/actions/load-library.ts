import {
  getAllBooks,
  getBookCoverUrl,
} from "@/services/storage/book-repository";

import { libraryStore } from "../store/library-store";
import { pwaStore } from "@/features/pwa/store/pwa-store";

/**
 * @param silent skip the global loading flag — used by the visibility-change
 * re-fetch so an already-populated grid isn't blanked by the loading state.
 */
export async function loadLibrary({
  silent = false,
}: { silent?: boolean } = {}) {
  const store = libraryStore.getState();

  try {
    if (!silent) store.setLoading(true);
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

    if (silent) {
      // Merge fresh data into the store's *current* books, not the snapshot
      // this async work started from — a synchronous mutation (delete/
      // import) that landed while the cover fetches above were in flight
      // must not be silently undone by overwriting the whole array with a
      // stale one. Only safe for the silent (already-populated) refetch —
      // a non-silent load has no established state yet to merge against,
      // so it always replaces outright (see the plain setBooks below).
      // ponytail: a book whose progress/status changed mid-fetch (rather
      // than being added/removed) can still be briefly overwritten with
      // pre-change data here; closing that too would need a version/
      // generation token.
      const freshById = new Map(
        booksWithProgress.map((book) => [book.id, book]),
      );
      store.setBooks(
        libraryStore
          .getState()
          .books.map((book) => freshById.get(book.id) ?? book),
      );
    } else {
      store.setBooks(booksWithProgress);
    }
  } catch (error) {
    store.setError(`Failed to load library: ${error}`);
  } finally {
    if (!silent) store.setLoading(false);
  }
}
