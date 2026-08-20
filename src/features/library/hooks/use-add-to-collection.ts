import { useEffect, useState } from "react";

import {
  getMembersForBook,
  getMembersForGrouping,
  listGroupings,
} from "@/services/storage/groupings";
import type { Grouping } from "@/services/storage/storage-types";
import {
  addBookToCollection,
  createCollection,
  removeBookFromCollection,
} from "../actions/collections";

/** Data + actions behind the "Add to Collection" sheet on a book card:
 * every collection, its book count, and which ones already contain this
 * book — reloaded each time the sheet opens so it reflects any create/
 * toggle that happened last time it was open. */
export function useAddToCollection(bookId: string, open: boolean) {
  const [collections, setCollections] = useState<
    (Grouping & { bookCount: number })[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = async (
    onResult: (
      collections: (Grouping & { bookCount: number })[],
      selectedIds: Set<string>,
    ) => void,
  ) => {
    const [allCollections, bookMembers] = await Promise.all([
      listGroupings("collection"),
      getMembersForBook(bookId),
    ]);
    const withCounts = await Promise.all(
      allCollections.map(async (grouping) => ({
        ...grouping,
        bookCount: (await getMembersForGrouping(grouping.id)).length,
      })),
    );
    onResult(
      withCounts,
      new Set(bookMembers.map((member) => member.groupingId)),
    );
  };

  useEffect(() => {
    let cancelled = false;
    if (open) {
      void load((collections, selectedIds) => {
        if (cancelled) return;
        setCollections(collections);
        setSelectedIds(selectedIds);
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookId]);

  const refresh = () =>
    load((collections, selectedIds) => {
      setCollections(collections);
      setSelectedIds(selectedIds);
    });

  const toggle = async (groupingId: string) => {
    if (selectedIds.has(groupingId)) {
      await removeBookFromCollection(groupingId, bookId);
    } else {
      await addBookToCollection(groupingId, bookId);
    }
    await refresh();
  };

  const createAndAdd = async (name: string) => {
    const groupingId = await createCollection(name);
    await addBookToCollection(groupingId, bookId);
    await refresh();
  };

  return { collections, selectedIds, toggle, createAndAdd };
}
