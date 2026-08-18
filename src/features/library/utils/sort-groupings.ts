import type {
  Grouping,
  GroupingMember,
  StoredBook,
} from "@/services/storage/storage-types";

export type ShelvesSortOption = "alphabetical" | "createdAt" | "updatedAt";
export type ShelvesViewMode = "merged" | "grouped";

// GroupingCard renders one large cover plus two stacked small ones — a
// 4th cover would have nowhere to go.
const MAX_COVER_SLOTS = 3;

/** One cover-stack slot: a real cover URL when the book has one, otherwise
 * just the book id so the card can fall back to that book's own derived
 * gradient (see getBookCoverVisual) instead of a generic placeholder. */
export interface GroupingCoverSlot {
  bookId: string;
  coverUrl?: string;
}

export interface GroupingWithMeta {
  grouping: Grouping;
  memberBookIds: string[];
  effectiveCreatedAt: number;
  effectiveUpdatedAt: number;
  coverSlots: GroupingCoverSlot[];
}

/**
 * A series has no create/rename/add/remove action of its own to stamp
 * createdAt/updatedAt on the Grouping row itself, so both are derived from
 * its member books' createdAt (earliest = created, latest = updated) —
 * see decision 3/4 of the Shelves tab spec. A collection uses its own
 * stored fields directly. Cover slots are derived here too: members with a
 * real cover fill slots first, then members without one (their gradient is
 * derived client-side from their id), capped at MAX_COVER_SLOTS — a slot
 * simply doesn't exist once there are fewer members than slots, which is
 * the only case GroupingCard falls back to a plain placeholder.
 */
export function buildGroupingsWithMeta(
  groupings: Grouping[],
  membersByGrouping: Map<string, GroupingMember[]>,
  booksById: Map<string, StoredBook>,
): GroupingWithMeta[] {
  return groupings.map((grouping) => {
    const members = membersByGrouping.get(grouping.id) ?? [];
    const memberBookIds = members.map((member) => member.bookId);

    const withCover: GroupingCoverSlot[] = [];
    const withoutCover: GroupingCoverSlot[] = [];
    for (const bookId of memberBookIds) {
      const coverUrl = booksById.get(bookId)?.coverBg;
      (coverUrl ? withCover : withoutCover).push({ bookId, coverUrl });
    }
    const coverSlots = [...withCover, ...withoutCover].slice(
      0,
      MAX_COVER_SLOTS,
    );

    if (grouping.type === "collection") {
      return {
        grouping,
        memberBookIds,
        effectiveCreatedAt: grouping.createdAt,
        effectiveUpdatedAt: grouping.updatedAt,
        coverSlots,
      };
    }

    const memberCreatedAts = memberBookIds
      .map((bookId) => booksById.get(bookId)?.createdAt)
      .filter((value): value is number => value != null);

    return {
      grouping,
      memberBookIds,
      effectiveCreatedAt:
        memberCreatedAts.length > 0
          ? Math.min(...memberCreatedAts)
          : grouping.createdAt,
      effectiveUpdatedAt:
        memberCreatedAts.length > 0
          ? Math.max(...memberCreatedAts)
          : grouping.updatedAt,
      coverSlots,
    };
  });
}

export function sortGroupings(
  items: GroupingWithMeta[],
  sortBy: ShelvesSortOption,
): GroupingWithMeta[] {
  const sorted = [...items];

  switch (sortBy) {
    case "alphabetical":
      return sorted.sort((a, b) =>
        a.grouping.name.localeCompare(b.grouping.name),
      );
    case "createdAt":
      return sorted.sort((a, b) => b.effectiveCreatedAt - a.effectiveCreatedAt);
    case "updatedAt":
      return sorted.sort((a, b) => b.effectiveUpdatedAt - a.effectiveUpdatedAt);
  }
}

export function splitByType(items: GroupingWithMeta[]): {
  merged: GroupingWithMeta[];
  series: GroupingWithMeta[];
  collections: GroupingWithMeta[];
} {
  return {
    merged: items,
    series: items.filter((item) => item.grouping.type === "series"),
    collections: items.filter((item) => item.grouping.type === "collection"),
  };
}
