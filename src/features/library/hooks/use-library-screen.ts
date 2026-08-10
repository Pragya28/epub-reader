import { useEffect, useMemo } from "react";

import { useChromeVisibility } from "@/shared/hooks/use-chrome-visibility";
import { libraryStore } from "../store/library-store";
import { loadLibrary } from "../actions/load-library";
import {
  enrichBookWithProgress,
  pickCurrentlyReadingBook,
} from "../utils/derive-book-status";
import { filterBooksByCriteria } from "../utils/filter-books";
import { sortBooks } from "../utils/sort-books";
import { useLibraryFilters } from "./use-library-filters";

/**
 * All non-visual state/derivation behind the library screen: loading the
 * library on mount (and re-fetching on tab-visible, since the reader flushes
 * its final progress save on unmount), and the sort/filter pipeline. Query
 * search lives on its own screen (src/app/screens/search-screen.tsx).
 * Kept separate from LibraryScreen so that component stays presentational.
 */
export function useLibraryScreen() {
  const { books, isLoading, error } = libraryStore();

  const {
    visible: headerVisible,
    handleScroll: handleChromeScroll,
    setOverlay,
    reveal: revealHeader,
  } = useChromeVisibility();

  useEffect(() => {
    const handleScroll = () => handleChromeScroll(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleChromeScroll]);

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

  // Recomputing this enrich→sort→filter→search pipeline on every render
  // was cheap until the header's scroll-driven visibility toggle (Day 4)
  // started re-rendering LibraryScreen on every ~8px of scroll — now it's
  // a hot path. Memoized so an unrelated re-render (scroll, chrome state)
  // doesn't re-derive or reallocate the whole list.
  const enriched = useMemo(() => books.map(enrichBookWithProgress), [books]);

  // Continue-reading always reflects the whole library, not whatever the
  // user currently has filtered/searched down to.
  const currentBook = useMemo(
    () => pickCurrentlyReadingBook(enriched),
    [enriched],
  );

  const {
    isFiltering,
    filterOpen,
    setFilterOpen,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    resetFilters,
    languages,
  } = useLibraryFilters(enriched);

  useEffect(() => setOverlay(filterOpen), [filterOpen, setOverlay]);

  const visibleBooks = useMemo(() => {
    const sorted = sortBooks(enriched, sortBy);
    return filterBooksByCriteria(sorted, filters);
  }, [enriched, sortBy, filters]);

  return {
    isLoading,
    error,
    currentBook,
    visibleBooks,
    isFiltering,
    headerVisible,
    revealHeader,

    filterOpen,
    setFilterOpen,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    resetFilters,
    languages,
  };
}
