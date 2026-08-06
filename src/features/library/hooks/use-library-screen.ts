import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useChromeVisibility } from "@/shared/hooks/use-chrome-visibility";
import { libraryStore } from "../store/library-store";
import { libraryFilterStore } from "../store/library-filter-store";
import { loadLibrary } from "../actions/load-library";
import {
  enrichBookWithProgress,
  pickCurrentlyReadingBook,
} from "../utils/derive-book-status";
import {
  filterBooksByCriteria,
  filterBooksByQuery,
  hasActiveFilters,
} from "../utils/filter-books";
import { sortBooks } from "../utils/sort-books";

/**
 * All non-visual state/derivation behind the library screen: loading the
 * library on mount (and re-fetching on tab-visible, since the reader flushes
 * its final progress save on unmount), and the search/sort/filter pipeline.
 * Kept separate from LibraryScreen so that component stays presentational.
 */
export function useLibraryScreen() {
  const { books, isLoading, error } = libraryStore();
  const {
    query,
    sortBy,
    filters,
    setQuery,
    setSortBy,
    setFilters,
    resetFilters,
  } = libraryFilterStore(
    useShallow((state) => ({
      query: state.query,
      sortBy: state.sortBy,
      filters: state.filters,
      setQuery: state.setQuery,
      setSortBy: state.setSortBy,
      setFilters: state.setFilters,
      resetFilters: state.resetFilters,
    })),
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  const {
    visible: headerVisible,
    handleScrollDirection,
    setOverlay,
  } = useChromeVisibility();

  useEffect(() => setOverlay(filterOpen), [filterOpen, setOverlay]);

  // Momentum/rubber-band scrolling wobbles scrollY by a pixel or two while
  // decelerating or bouncing at a boundary — reacting to every such change
  // flips the header visible/hidden many times a second. A minimum-delta
  // threshold before honoring a direction change absorbs that jitter.
  const SCROLL_DIRECTION_THRESHOLD = 8;
  const lastScrollY = useRef(0);
  useEffect(() => {
    const handleScroll = () => {
      const y = Math.max(0, window.scrollY);
      if (y <= 0) {
        handleScrollDirection("up");
      } else if (
        Math.abs(y - lastScrollY.current) >= SCROLL_DIRECTION_THRESHOLD
      ) {
        handleScrollDirection(y > lastScrollY.current ? "down" : "up");
      } else {
        return;
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScrollDirection]);

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

  const languages = useMemo(
    () =>
      Array.from(
        new Set(enriched.map((book) => book.language).filter(Boolean)),
      ) as string[],
    [enriched],
  );

  const isFiltering = hasActiveFilters(filters);
  const isSearching = searchOpen && query.trim() !== "";

  const visibleBooks = useMemo(() => {
    const sorted = sortBooks(enriched, sortBy);
    const filtered = filterBooksByCriteria(sorted, filters);
    return isSearching ? filterBooksByQuery(filtered, query) : filtered;
  }, [enriched, sortBy, filters, isSearching, query]);

  return {
    isLoading,
    error,
    currentBook,
    visibleBooks,
    isSearching,
    isFiltering,
    headerVisible,

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
    resetFilters,
    languages,
  };
}
