import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SortOption } from "../utils/sort-books";
import { DEFAULT_SORT } from "../utils/sort-books";
import type { LibraryFilters } from "../utils/filter-books";
import { DEFAULT_LIBRARY_FILTERS } from "../utils/filter-books";

interface LibraryFilterStore {
  sortBy: SortOption;
  filters: LibraryFilters;
  setSortBy: (sortBy: SortOption) => void;
  setFilters: (filters: LibraryFilters) => void;
  resetFilters: () => void;
}

// Persists sort/filter choices across sessions so reopening the library
// doesn't lose the user's view. Query search moved to its own screen
// (src/app/screens/search-screen.tsx) and no longer lives here.
export const libraryFilterStore = create<LibraryFilterStore>()(
  persist(
    (set) => ({
      sortBy: DEFAULT_SORT,
      filters: DEFAULT_LIBRARY_FILTERS,
      setSortBy: (sortBy) => set({ sortBy }),
      setFilters: (filters) => set({ filters }),
      resetFilters: () => set({ filters: DEFAULT_LIBRARY_FILTERS }),
    }),
    { name: "library-filter-store" },
  ),
);
