import { useEffect, useMemo, useState } from "react";

import { useChromeVisibility } from "@/shared/hooks/use-chrome-visibility";
import { getNextInSeries } from "@/services/storage/groupings";
import type { BookWithProgress } from "../types/library.types";
import { libraryStore } from "../store/library-store";
import { pwaStore } from "@/features/pwa/store/pwa-store";
import { libraryFilterStore } from "../store/filter-store";
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
  const { books, isLoading, error, evicted, setEvicted } = libraryStore();

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
        // silent: the grid is already populated — don't blank it behind the
        // loading state on every return-to-foreground.
        void loadLibrary({ silent: true });
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

  // When the banner candidate is finished rather than mid-book, the
  // banner should point at the next book in its series instead of the
  // book itself — resolved separately since it's an async lookup, not a
  // sync derivation like everything else above.
  const [nextBook, setNextBook] = useState<BookWithProgress | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveNextBook() {
      if (
        !currentBook?.isFinished ||
        !currentBook.seriesGroupingId ||
        currentBook.seriesIndex === undefined
      ) {
        if (!cancelled) setNextBook(null);
        return;
      }

      const book = await getNextInSeries(
        currentBook.seriesGroupingId,
        currentBook.seriesIndex,
      );
      if (!cancelled) setNextBook(book ? enrichBookWithProgress(book) : null);
    }

    void resolveNextBook();
    return () => {
      cancelled = true;
    };
  }, [currentBook]);

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
  } = useLibraryFilters(enriched, libraryFilterStore);

  useEffect(() => setOverlay(filterOpen), [filterOpen, setOverlay]);

  const visibleBooks = useMemo(() => {
    const sorted = sortBooks(enriched, sortBy);
    return filterBooksByCriteria(sorted, filters);
  }, [enriched, sortBy, filters]);

  return {
    isLoading,
    error,
    evicted,
    dismissEvicted: () => {
      setEvicted(false);
      pwaStore.getState().setHadBooks(false);
    },
    currentBook,
    nextBook,
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
