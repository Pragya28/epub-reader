import { useParams } from "react-router-dom";

import { isCollection } from "@/services/storage/groupings";
import { seriesFilterStore } from "../store/filter-store";
import { filterBooksByCriteria, hasActiveFilters } from "../utils/filter-books";
import { useGroupingBooks } from "./use-grouping-books";
import { useLibraryFilters } from "./use-library-filters";

/**
 * Books by a single series, reached from a book card's "View Series"
 * action. Always ordered by GroupingMember.order (title as tiebreak) —
 * never user-sortable, unlike the author screen: a series reads as one
 * ordered sequence. hideFinished defaults to false here specifically (a
 * series is a small curated list, not a big library needing decluttering)
 * via a per-instance override, not a change to DEFAULT_LIBRARY_FILTERS.
 */
export function useSeriesDetailScreen() {
  const { groupingId } = useParams<{ groupingId: string }>();
  const { grouping, orderedBooks, isLoading } = useGroupingBooks(groupingId);

  const {
    filterOpen,
    setFilterOpen,
    filters,
    setFilters,
    resetFilters,
    languages,
    isFiltering,
  } = useLibraryFilters(orderedBooks, seriesFilterStore);

  // Per-instance default: series screens declutter differently from the
  // main library, so a fresh (never-touched) filter state should show
  // finished books rather than hide them, without changing the shared
  // DEFAULT_LIBRARY_FILTERS every other screen also uses. hasActiveFilters
  // already knows what "untouched" means, so it's reused here rather than
  // re-deriving the same comparison field by field.
  const effectiveFilters = !hasActiveFilters(filters)
    ? { ...filters, hideFinished: false }
    : filters;

  const visibleBooks = filterBooksByCriteria(orderedBooks, effectiveFilters);

  return {
    groupingName: grouping?.name ?? null,
    redirectToShelves:
      grouping === null || (grouping ? isCollection(grouping) : false),
    isLoading,
    error: null,
    books: visibleBooks,
    isFiltering,
    filterOpen,
    setFilterOpen,
    filters: effectiveFilters,
    setFilters,
    resetFilters,
    languages,
  };
}
