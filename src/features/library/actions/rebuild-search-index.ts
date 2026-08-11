import { deleteIndex } from "@/services/search/search-index";
import { buildIndex } from "@/services/search/search-service";
import { getAllBooks, getBookFile } from "@/services/storage/book-repository";

/**
 * Wipes and rebuilds the search index for every book, one at a time.
 * Sequential (not Promise.all) — running every book's JSZip parse
 * concurrently is real resource contention on lower-end devices. A single
 * book's failure (missing/corrupted file) is counted, not thrown, so it
 * doesn't block the rest of the library from getting a fresh index.
 */
export async function rebuildSearchIndex(): Promise<{
  total: number;
  failed: number;
}> {
  const books = await getAllBooks();
  let failed = 0;

  for (const book of books) {
    try {
      await deleteIndex(book.id);
      const stored = await getBookFile(book.id);
      if (!stored) {
        failed += 1;
        continue;
      }
      await buildIndex(book.id, stored.file);
    } catch {
      failed += 1;
    }
  }

  return { total: books.length, failed };
}
