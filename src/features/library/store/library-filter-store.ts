import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SortOption } from "../utils/sort-books";
import { DEFAULT_SORT } from "../utils/sort-books";
import type { LibraryFilters } from "../utils/filter-books";
import { DEFAULT_LIBRARY_FILTERS } from "../utils/filter-books";

interface LibraryFilterStore {
  query: string;
  sortBy: SortOption;
  filters: LibraryFilters;
  setQuery: (query: string) => void;
  setSortBy: (sortBy: SortOption) => void;
  setFilters: (filters: LibraryFilters) => void;
  resetFilters: () => void;
}

// Persists search/sort/filter choices across sessions so reopening a screen
// doesn't lose the user's view. searchOpen (panel visibility) stays local UI
// state in the screen hooks — it's chrome, not a filter choice.
// Factory (not a singleton) so each screen that lists books — library,
// per-author — keeps its own sort/filter/search state instead of sharing one.
function createLibraryFilterStore(name: string) {
  return create<LibraryFilterStore>()(
    persist(
      (set) => ({
        query: "",
        sortBy: DEFAULT_SORT,
        filters: DEFAULT_LIBRARY_FILTERS,
        setQuery: (query) => set({ query }),
        setSortBy: (sortBy) => set({ sortBy }),
        setFilters: (filters) => set({ filters }),
        resetFilters: () => set({ filters: DEFAULT_LIBRARY_FILTERS }),
      }),
      { name },
    ),
  );
}

export const libraryFilterStore = createLibraryFilterStore(
  "library-filter-store",
);
export const authorFilterStore = createLibraryFilterStore(
  "author-filter-store",
);
