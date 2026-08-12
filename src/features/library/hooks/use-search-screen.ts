import { useEffect, useMemo, useState } from "react";
import { libraryStore } from "../store/library-store";
import { enrichBookWithProgress } from "../utils/derive-book-status";
import { searchLibrary } from "../actions/search-library";
import { loadLibrary } from "../actions/load-library";
import { logger as rootLogger } from "@/shared/logger/logger";
import {
  DEFAULT_SEARCH_STATUS_FILTER,
  filterSearchResultsByStatus,
  type SearchStatusFilter,
} from "../utils/filter-search-results";
import type { LibrarySearchResults } from "../actions/search-library";

const logger = rootLogger.child("use-search-screen");

/** Long enough to skip mid-word prefixes, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * One- and two-letter queries match nearly every chapter in the library —
 * the most expensive possible search for the least useful result. The cost
 * is in building result rows, so the guard is on running the search at all.
 */
const MIN_QUERY_LENGTH = 3;

const EMPTY_RESULTS: LibrarySearchResults = {
  metadataMatches: [],
  contentMatches: [],
};

/**
 * Data layer behind the search results screen: live-filters the library as
 * the query changes. Kept separate from the screen component so it stays
 * presentational, matching useLibraryScreen/useReaderScreen.
 */
export function useSearchScreen() {
  const { books } = libraryStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibrarySearchResults>(EMPTY_RESULTS);
  // The query `results` currently correspond to. Loading is derived from
  // this rather than set at the top of the effect, because a synchronous
  // setState in an effect body is what react-hooks/set-state-in-effect
  // forbids (same reason `results` isn't reset there either, below).
  const [settledQuery, setSettledQuery] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SearchStatusFilter>(
    DEFAULT_SEARCH_STATUS_FILTER,
  );

  // The library is normally populated by the library screen, but search can
  // be reached directly (deep link, or a refresh while on this screen) with
  // an empty store — which silently broke metadata search (nothing to match
  // against) and made the status filter a no-op (content matches couldn't
  // resolve their book). Load it here rather than depending on arrival path.
  useEffect(() => {
    if (books.length === 0) void loadLibrary();
  }, [books.length]);

  const enriched = useMemo(() => books.map(enrichBookWithProgress), [books]);

  const trimmed = query.trim();
  const isSearching = trimmed.length >= MIN_QUERY_LENGTH;
  /** Typed something, but not yet enough to search on. */
  const needsMoreInput = trimmed.length > 0 && !isSearching;

  useEffect(() => {
    if (!isSearching) return;

    let cancelled = false;

    // Debounced: without this every keystroke ran a full search, so typing
    // "Harry" fired five of them — and the single-letter prefixes are the
    // most expensive, matching nearly every chapter in the library.
    const timer = setTimeout(() => {
      void searchLibrary(enriched, query)
        .then((next) => {
          if (!cancelled) setResults(next);
        })
        // Without this, a rejected search left the previous (or empty)
        // results on screen under a "0 results found" label — a false
        // negative that reads as "you don't own this book".
        .catch((error) => {
          logger.error("search failed", error);
          if (!cancelled) setResults(EMPTY_RESULTS);
        })
        .finally(() => {
          if (!cancelled) setSettledQuery(query);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enriched, query, isSearching]);

  // Falls back to EMPTY_RESULTS whenever the query is cleared, rather than
  // resetting `results` state from inside the effect above (which would be
  // a synchronous setState-in-effect — see react-hooks/set-state-in-effect).
  // Results are only shown for the query they were computed for. Without the
  // settledQuery check, retyping left the previous term's results on screen
  // until the new search resolved — so you'd see hits for "Harr" while the
  // box read "Harry", which looks like wrong answers rather than pending ones.
  const displayResults =
    isSearching && settledQuery === query ? results : EMPTY_RESULTS;

  // Status scoping is applied here rather than inside searchLibrary so
  // changing the filter re-renders from cached results instead of
  // re-running the search (and its index backfill).
  const scoped = useMemo(
    () => filterSearchResultsByStatus(displayResults, enriched, statusFilter),
    [displayResults, enriched, statusFilter],
  );

  return {
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    hiddenCount: scoped.hiddenCount,
    metadataMatches: scoped.metadataMatches,
    contentMatches: scoped.contentMatches,
    resultCount: scoped.metadataMatches.length + scoped.contentMatches.length,
    isSearching,
    needsMoreInput,
    minQueryLength: MIN_QUERY_LENGTH,
    isLoading: isSearching && settledQuery !== query,
  };
}
