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
import { loadLibrary } from "../actions/load-library";
import { enrichBookWithProgress } from "../utils/derive-book-status";
import { notify } from "@/components/toast/toast";

const NO_MEMBERS: GroupingMember[] = [];

interface LoadedGrouping {
  id: string | undefined;
  grouping: Grouping | null;
  members: GroupingMember[];
}

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

  const [loaded, setLoaded] = useState<LoadedGrouping | null>(null);

  async function load(
    onResult: (g: Grouping | null, m: GroupingMember[]) => void,
  ) {
    if (!groupingId) return;
    try {
      const [foundGrouping, foundMembers] = await Promise.all([
        getGrouping(groupingId),
        getMembersForGrouping(groupingId),
      ]);
      onResult(foundGrouping ?? null, foundMembers);
    } catch {
      notify.error("Couldn't load this shelf. Try again.");
      onResult(null, []);
    }
  }

  useEffect(() => {
    let cancelled = false;

    // The detail screens filter libraryStore().books; on a deep-link or hard
    // refresh that store is empty. Populate it (silent — this screen owns its
    // own loading state) so a populated grouping doesn't render as empty.
    if (libraryStore.getState().books.length === 0) {
      void loadLibrary({ silent: true });
    }

    void load((g, m) => {
      if (cancelled) return;
      setLoaded({ id: groupingId, grouping: g, members: m });
    });
    return () => {
      cancelled = true;
    };
    // groupingId is the only dependency load() reads besides the setter,
    // which is stable — re-declaring `load` every render isn't a real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupingId]);

  // Ignore data loaded for a previous groupingId: a groupingId change on the
  // same route element would otherwise keep showing the stale grouping (and
  // its redirect verdict) with no spinner until the new load resolves.
  const fresh = loaded && loaded.id === groupingId ? loaded : null;
  const grouping = fresh ? fresh.grouping : undefined;
  const members = fresh ? fresh.members : NO_MEMBERS;

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
      void load((g, m) =>
        setLoaded({ id: groupingId, grouping: g, members: m }),
      ),
  };
}
