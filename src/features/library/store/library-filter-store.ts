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

// Persists search/sort/filter choices across sessions so reopening the
// library doesn't lose the user's view. searchOpen (panel visibility) stays
// local UI state in useLibraryScreen — it's chrome, not a filter choice.
export const libraryFilterStore = create<LibraryFilterStore>()(
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
    { name: "library-filter-store" },
  ),
);
