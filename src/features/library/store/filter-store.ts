import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SortOption } from "../utils/sort-books";
import { DEFAULT_SORT } from "../utils/sort-books";
import type { LibraryFilters } from "../utils/filter-books";
import { DEFAULT_LIBRARY_FILTERS } from "../utils/filter-books";

interface FilterStore {
  sortBy: SortOption;
  filters: LibraryFilters;
  setSortBy: (sortBy: SortOption) => void;
  setFilters: (filters: LibraryFilters) => void;
  resetFilters: () => void;
}

// Persists sort/filter choices across sessions so reopening a screen doesn't
// lose the user's view. Query search moved to its own screen
// (src/app/screens/search-screen.tsx) and no longer lives here.
// Factory (not a singleton) so each screen that lists books — library,
// per-author — keeps its own sort/filter state instead of sharing one.
function createFilterStore(name: string) {
  return create<FilterStore>()(
    persist(
      (set) => ({
        sortBy: DEFAULT_SORT,
        filters: DEFAULT_LIBRARY_FILTERS,
        setSortBy: (sortBy) => set({ sortBy }),
        setFilters: (filters) => set({ filters }),
        resetFilters: () => set({ filters: DEFAULT_LIBRARY_FILTERS }),
      }),
      { name },
    ),
  );
}

export const libraryFilterStore = createFilterStore("library-filter-store");
export const authorFilterStore = createFilterStore("author-filter-store");
export const seriesFilterStore = createFilterStore("series-filter-store");
export const collectionFilterStore = createFilterStore(
  "collection-filter-store",
);
