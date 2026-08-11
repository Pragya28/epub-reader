import type { LibrarySearchResults } from "../actions/search-library";
import type { BookWithProgress } from "../types/library.types";

/**
 * Search-result scope by reading status. Deliberately three states rather
 * than the library grid's full `LibraryFilters` — on a search screen the
 * user has already narrowed by query, so status is the only axis worth a
 * control here. "unfinished" is the union of unread + reading, matching
 * what `hideFinished` expresses in filter-books.ts.
 */
export type SearchStatusFilter = "unfinished" | "all" | "finished";

export const DEFAULT_SEARCH_STATUS_FILTER: SearchStatusFilter = "unfinished";

function matchesFilter(
  book: BookWithProgress | undefined,
  filter: SearchStatusFilter,
): boolean {
  // A result whose book isn't in the library list can't be classified —
  // show it rather than silently dropping it.
  if (!book) return true;

  if (filter === "all") return true;
  return filter === "finished" ? book.isFinished === true : !book.isFinished;
}

export interface ScopedSearchResults extends LibrarySearchResults {
  /**
   * How many results the current filter is hiding. Surfaced in the UI so a
   * default that excludes finished books can never read as "you don't own
   * this book" — the exact false negative the index-backfill bug produced.
   */
  hiddenCount: number;
}

export function filterSearchResultsByStatus(
  results: LibrarySearchResults,
  books: BookWithProgress[],
  filter: SearchStatusFilter,
): ScopedSearchResults {
  const booksById = new Map(books.map((book) => [book.id, book]));

  const metadataMatches = results.metadataMatches.filter((book) =>
    matchesFilter(book, filter),
  );
  const contentMatches = results.contentMatches.filter((match) =>
    matchesFilter(booksById.get(match.bookId), filter),
  );

  const total = results.metadataMatches.length + results.contentMatches.length;
  const shown = metadataMatches.length + contentMatches.length;

  return { metadataMatches, contentMatches, hiddenCount: total - shown };
}
