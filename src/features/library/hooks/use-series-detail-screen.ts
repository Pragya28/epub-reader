import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  getGrouping,
  getMembersForGrouping,
  isCollection,
} from "@/services/storage/groupings";
import type {
  Grouping,
  GroupingMember,
} from "@/services/storage/storage-types";
import { libraryStore } from "../store/library-store";
import { seriesFilterStore } from "../store/filter-store";
import { enrichBookWithProgress } from "../utils/derive-book-status";
import { filterBooksByCriteria, hasActiveFilters } from "../utils/filter-books";
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
  const { books } = libraryStore();

  const [grouping, setGrouping] = useState<Grouping | null | undefined>(
    undefined,
  );
  const [members, setMembers] = useState<GroupingMember[]>([]);

  useEffect(() => {
    if (!groupingId) return;
    let cancelled = false;

    void Promise.all([
      getGrouping(groupingId),
      getMembersForGrouping(groupingId),
    ]).then(([foundGrouping, foundMembers]) => {
      if (cancelled) return;
      setGrouping(foundGrouping ?? null);
      setMembers(foundMembers);
    });

    return () => {
      cancelled = true;
    };
  }, [groupingId]);

  const orderById = useMemo(
    () => new Map(members.map((member) => [member.bookId, member.order])),
    [members],
  );

  const enriched = useMemo(() => books.map(enrichBookWithProgress), [books]);

  const seriesBooks = useMemo(() => {
    const inSeries = enriched.filter((book) => orderById.has(book.id));
    // Nulls (missing order) sort last; ties (including two nulls) fall
    // back to title. `?? Infinity` does the "nulls last" half in one
    // expression instead of three separate null-check branches.
    return [...inSeries].sort(
      (a, b) =>
        (orderById.get(a.id) ?? Infinity) - (orderById.get(b.id) ?? Infinity) ||
        a.title.localeCompare(b.title),
    );
  }, [enriched, orderById]);

  const {
    filterOpen,
    setFilterOpen,
    filters,
    setFilters,
    resetFilters,
    languages,
    isFiltering,
  } = useLibraryFilters(seriesBooks, seriesFilterStore);

  // Per-instance default: series screens declutter differently from the
  // main library, so a fresh (never-touched) filter state should show
  // finished books rather than hide them, without changing the shared
  // DEFAULT_LIBRARY_FILTERS every other screen also uses. hasActiveFilters
  // already knows what "untouched" means, so it's reused here rather than
  // re-deriving the same comparison field by field.
  const effectiveFilters = !hasActiveFilters(filters)
    ? { ...filters, hideFinished: false }
    : filters;

  const visibleBooks = filterBooksByCriteria(seriesBooks, effectiveFilters);

  return {
    groupingName: grouping?.name ?? null,
    redirectToShelves:
      grouping === null || (grouping ? isCollection(grouping) : false),
    isLoading: grouping === undefined,
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
