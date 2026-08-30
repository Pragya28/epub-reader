import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  listGroupings,
  getMembersForGrouping,
  ensureSeriesGroupings,
} from "@/services/storage/groupings";
import type {
  Grouping,
  GroupingMember,
} from "@/services/storage/storage-types";
import { libraryStore } from "../store/library-store";
import { shelvesStore } from "../store/shelves-store";
import {
  buildGroupingsWithMeta,
  sortGroupings,
  splitByType,
} from "../utils/sort-groupings";

/**
 * Data layer behind the Shelves tab: loads every Grouping + its members,
 * derives sort metadata and cover art, and exposes merged/series/
 * collections views per shelvesStore. Reuses libraryStore's already-loaded
 * books (populated by the Books tab's loadLibrary()) for cover art instead
 * of a separate fetch — same pattern as hasMoreByAuthor counting
 * client-side against the loaded library.
 */
export function useShelvesScreen() {
  const { books } = libraryStore();
  const [groupings, setGroupings] = useState<Grouping[]>([]);
  const [membersByGrouping, setMembersByGrouping] = useState<
    Map<string, GroupingMember[]>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const { sortBy, setSortBy, viewMode, setViewMode } = shelvesStore(
    useShallow((state) => ({
      sortBy: state.sortBy,
      setSortBy: state.setSortBy,
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
    })),
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Backfill series groupings for books that predate the grouping schema
      // (derived from the cached seriesName on each row, no re-parsing) so an
      // older library's series appear here rather than never at all.
      await ensureSeriesGroupings(
        libraryStore.getState().books.map((book) => book.id),
      );

      const all = await listGroupings();
      const entries = await Promise.all(
        all.map(
          async (grouping) =>
            [grouping.id, await getMembersForGrouping(grouping.id)] as const,
        ),
      );
      if (cancelled) return;
      setGroupings(all);
      setMembersByGrouping(new Map(entries));
      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const booksById = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books],
  );

  // One memo, not three: buildGroupingsWithMeta/sortGroupings/splitByType
  // are cheap array ops over a handful of groupings — chaining a separate
  // useMemo per stage only adds re-render bookkeeping, not real caching.
  const { merged, series, collections } = useMemo(
    () =>
      splitByType(
        sortGroupings(
          buildGroupingsWithMeta(groupings, membersByGrouping, booksById),
          sortBy,
        ),
      ),
    [groupings, membersByGrouping, booksById, sortBy],
  );

  return {
    isLoading,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    isEmpty: !isLoading && groupings.length === 0,
    merged,
    series,
    collections,
  };
}
