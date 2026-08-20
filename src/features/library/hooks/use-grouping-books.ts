import { useEffect, useMemo, useState } from "react";

import {
  getGrouping,
  getMembersForGrouping,
} from "@/services/storage/groupings";
import type {
  Grouping,
  GroupingMember,
} from "@/services/storage/storage-types";
import { libraryStore } from "../store/library-store";
import { enrichBookWithProgress } from "../utils/derive-book-status";

/**
 * Shared fetch/order/enrich logic behind both the series and collection
 * detail screens: load a Grouping + its members, then order the library's
 * books by GroupingMember.order (title as tiebreak). Identical for both
 * grouping types — a collection's order is assigned sequentially at
 * add-time (see addBookToCollection), the same mechanism a series already
 * uses for its seriesIndex-derived order, so there's one ordering rule to
 * reason about rather than two. What differs per screen (redirect
 * predicate, filter defaults, rename/delete actions) stays in the caller.
 */
export function useGroupingBooks(groupingId: string | undefined) {
  const { books } = libraryStore();

  const [grouping, setGrouping] = useState<Grouping | null | undefined>(
    undefined,
  );
  const [members, setMembers] = useState<GroupingMember[]>([]);

  async function load(
    onResult: (g: Grouping | null, m: GroupingMember[]) => void,
  ) {
    if (!groupingId) return;
    const [foundGrouping, foundMembers] = await Promise.all([
      getGrouping(groupingId),
      getMembersForGrouping(groupingId),
    ]);
    onResult(foundGrouping ?? null, foundMembers);
  }

  useEffect(() => {
    let cancelled = false;
    void load((g, m) => {
      if (cancelled) return;
      setGrouping(g);
      setMembers(m);
    });
    return () => {
      cancelled = true;
    };
    // groupingId is the only dependency load() reads besides state setters,
    // which are stable — re-declaring `load` every render isn't a real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupingId]);

  const orderById = useMemo(
    () => new Map(members.map((member) => [member.bookId, member.order])),
    [members],
  );

  const enriched = useMemo(() => books.map(enrichBookWithProgress), [books]);

  const orderedBooks = useMemo(() => {
    const inGrouping = enriched.filter((book) => orderById.has(book.id));
    // Nulls (missing order) sort last; ties (including two nulls) fall
    // back to title. `?? Infinity` does the "nulls last" half in one
    // expression instead of three separate null-check branches.
    return [...inGrouping].sort(
      (a, b) =>
        (orderById.get(a.id) ?? Infinity) - (orderById.get(b.id) ?? Infinity) ||
        a.title.localeCompare(b.title),
    );
  }, [enriched, orderById]);

  return {
    grouping,
    orderedBooks,
    isLoading: grouping === undefined,
    reload: () =>
      void load((g, m) => {
        setGrouping(g);
        setMembers(m);
      }),
  };
}
