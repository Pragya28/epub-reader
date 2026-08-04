import type { BookWithProgress, ReadingStatus } from "../types/library.types";

/** Case-insensitive match across title, author and description. */
export function filterBooksByQuery(
  books: BookWithProgress[],
  query: string,
): BookWithProgress[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) return books;

  return books.filter((book) =>
    [book.title, book.author, book.description].some((field) =>
      field?.toLowerCase().includes(normalized),
    ),
  );
}

export function filterBooksByAuthor(
  books: BookWithProgress[],
  author: string,
): BookWithProgress[] {
  return books.filter((book) => book.author === author);
}

/**
 * Book-length buckets from docs/07 - Gaps/Library-01 Sort and Filter.md —
 * word count is the chosen size metric (chapter count varies too much
 * across publishers, page count isn't stable across screen/font sizes).
 */
export type LengthBucket = "short" | "medium" | "long" | "epic";

export function getLengthBucket(
  wordCount: number | undefined,
): LengthBucket | null {
  if (wordCount == null) return null;
  if (wordCount < 20_000) return "short";
  if (wordCount < 80_000) return "medium";
  if (wordCount < 150_000) return "long";
  return "epic";
}

export interface LibraryFilters {
  status: ReadingStatus | "all";
  language: string | "all";
  length: LengthBucket | "all";
  /** Declutters the default view; ignored when `status` already narrows to
   * a specific status (e.g. explicitly choosing "Finished" should show
   * finished books, not fight itself). */
  hideFinished: boolean;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  status: "all",
  language: "all",
  length: "all",
  hideFinished: true,
};

export function hasActiveFilters(filters: LibraryFilters): boolean {
  return (
    filters.status !== DEFAULT_LIBRARY_FILTERS.status ||
    filters.language !== DEFAULT_LIBRARY_FILTERS.language ||
    filters.length !== DEFAULT_LIBRARY_FILTERS.length ||
    filters.hideFinished !== DEFAULT_LIBRARY_FILTERS.hideFinished
  );
}

export function filterBooksByCriteria(
  books: BookWithProgress[],
  filters: LibraryFilters,
): BookWithProgress[] {
  return books.filter((book) => {
    if (filters.status !== "all" && book.status !== filters.status) {
      return false;
    }
    if (
      filters.status === "all" &&
      filters.hideFinished &&
      book.status === "finished"
    ) {
      return false;
    }
    if (filters.language !== "all" && book.language !== filters.language) {
      return false;
    }
    if (
      filters.length !== "all" &&
      getLengthBucket(book.wordCount) !== filters.length
    ) {
      return false;
    }
    return true;
  });
}
