import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import type { libraryFilterStore } from "../store/library-filter-store";
import { hasActiveFilters } from "../utils/filter-books";
import type { BookWithProgress } from "../types/library.types";

/**
 * Sort/filter state + the language list it's derived from, shared by any
 * screen that lists books. Takes the store instance so each screen (library,
 * per-author) can keep independent state instead of sharing one.
 */
export function useLibraryFilters(
  enriched: BookWithProgress[],
  filterStore: typeof libraryFilterStore,
) {
  const { sortBy, filters, setSortBy, setFilters, resetFilters } = filterStore(
    useShallow((state) => ({
      sortBy: state.sortBy,
      filters: state.filters,
      setSortBy: state.setSortBy,
      setFilters: state.setFilters,
      resetFilters: state.resetFilters,
    })),
  );
  const [filterOpen, setFilterOpen] = useState(false);

  const languages = useMemo(
    () =>
      Array.from(
        new Set(enriched.map((book) => book.language).filter(Boolean)),
      ) as string[],
    [enriched],
  );

  return {
    isFiltering: hasActiveFilters(filters),
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
