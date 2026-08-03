import { useEffect, useMemo, useState } from "react";

import { libraryStore } from "../store/library-store";
import { loadLibrary } from "../actions/load-library";
import {
  enrichBookWithProgress,
  pickCurrentlyReadingBook,
} from "../utils/derive-book-status";
import {
  DEFAULT_LIBRARY_FILTERS,
  filterBooksByCriteria,
  filterBooksByQuery,
  hasActiveFilters,
} from "../utils/filter-books";
import { DEFAULT_SORT, sortBooks } from "../utils/sort-books";

/**
 * All non-visual state/derivation behind the library screen: loading the
 * library on mount (and re-fetching on tab-visible, since the reader flushes
 * its final progress save on unmount), and the search/sort/filter pipeline.
 * Kept separate from LibraryScreen so that component stays presentational.
 */
export function useLibraryScreen() {
  const { books, isLoading } = libraryStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const [filters, setFilters] = useState(DEFAULT_LIBRARY_FILTERS);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  useEffect(() => {
    void loadLibrary();

    // When the user navigates back from the reader, the reader's cleanup
    // flushes the final progress save to the DB. We listen for the page
    // becoming visible again so we re-fetch after that write has settled,
    // ensuring the progress bar and continue-reading banner reflect the
    // session that just ended.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadLibrary();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const enriched = books.map(enrichBookWithProgress);

  // Continue-reading always reflects the whole library, not whatever the
  // user currently has filtered/searched down to.
  const currentBook = pickCurrentlyReadingBook(enriched);

  const languages = useMemo(
    () =>
      Array.from(
        new Set(enriched.map((book) => book.language).filter(Boolean)),
      ) as string[],
    [enriched],
  );
  const authors = useMemo(
    () =>
      Array.from(
        new Set(enriched.map((book) => book.author).filter(Boolean)),
      ) as string[],
    [enriched],
  );

  const isFiltering = hasActiveFilters(filters);
  const isSearching = searchOpen && query.trim() !== "";

  const sorted = sortBooks(enriched, sortBy);
  const filtered = filterBooksByCriteria(sorted, filters);
  const visibleBooks = isSearching
    ? filterBooksByQuery(filtered, query)
    : filtered;

  return {
    isLoading,
    currentBook,
    visibleBooks,
    isSearching,
    isFiltering,

    searchOpen,
    query,
    setQuery,
    openSearch: () => setSearchOpen(true),
    closeSearch,

    filterOpen,
    setFilterOpen,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    resetFilters: () => setFilters(DEFAULT_LIBRARY_FILTERS),
    languages,
    authors,
  };
}
