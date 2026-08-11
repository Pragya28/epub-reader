import { useEffect, useMemo, useState } from "react";
import { libraryStore } from "../store/library-store";
import { enrichBookWithProgress } from "../utils/derive-book-status";
import { searchLibrary } from "../actions/search-library";
import type { LibrarySearchResults } from "../actions/search-library";

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

  const enriched = useMemo(() => books.map(enrichBookWithProgress), [books]);

  const trimmed = query.trim();
  const isSearching = trimmed !== "";

  useEffect(() => {
    if (!isSearching) return;

    let cancelled = false;
    void searchLibrary(enriched, query).then((next) => {
      if (!cancelled) setResults(next);
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
  };
}
