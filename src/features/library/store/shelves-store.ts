import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  ShelvesSortOption,
  ShelvesViewMode,
} from "../utils/sort-groupings";

interface ShelvesStore {
  sortBy: ShelvesSortOption;
  viewMode: ShelvesViewMode;
  setSortBy: (sortBy: ShelvesSortOption) => void;
  setViewMode: (viewMode: ShelvesViewMode) => void;
}

// Separate from filter-store.ts's createFilterStore factory: that factory's
// SortOption/LibraryFilters shapes are book-grid specific (status/language/
// length/hideFinished) and don't fit "sort a list of groupings."
export const shelvesStore = create<ShelvesStore>()(
  persist(
    (set) => ({
      sortBy: "alphabetical",
      viewMode: "merged",
      setSortBy: (sortBy) => set({ sortBy }),
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    { name: "shelves-store" },
  ),
);
