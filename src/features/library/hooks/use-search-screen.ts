import { useEffect, useMemo, useState } from "react";
import { libraryStore } from "../store/library-store";
import { enrichBookWithProgress } from "../utils/derive-book-status";
import { searchLibrary } from "../actions/search-library";
import { logger as rootLogger } from "@/shared/logger/logger";
import type { LibrarySearchResults } from "../actions/search-library";

const logger = rootLogger.child("use-search-screen");

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

  const enriched = useMemo(() => books.map(enrichBookWithProgress), [books]);

  const trimmed = query.trim();
  const isSearching = trimmed !== "";

  useEffect(() => {
    if (!isSearching) return;

    let cancelled = false;

    void searchLibrary(enriched, query)
      .then((next) => {
        if (!cancelled) setResults(next);
      })
      // Without this, a rejected search left the previous (or empty) results
      // on screen under a "0 results found" label — a false negative that
      // reads as "you don't own this book".
      .catch((error) => {
        logger.error("search failed", error);
        if (!cancelled) setResults(EMPTY_RESULTS);
      })
      .finally(() => {
        if (!cancelled) setSettledQuery(query);
      });

    return () => {
      cancelled = true;
    };
  }, [enriched, query, isSearching]);

  // Falls back to EMPTY_RESULTS whenever the query is cleared, rather than
  // resetting `results` state from inside the effect above (which would be
  // a synchronous setState-in-effect — see react-hooks/set-state-in-effect).
  const displayResults = isSearching ? results : EMPTY_RESULTS;

  return {
    query,
    setQuery,
    metadataMatches: displayResults.metadataMatches,
    contentMatches: displayResults.contentMatches,
    resultCount:
      displayResults.metadataMatches.length +
      displayResults.contentMatches.length,
    isSearching,
    isLoading: isSearching && settledQuery !== query,
  };
}
