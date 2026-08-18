import type {
  Grouping,
  GroupingMember,
  StoredBook,
} from "@/services/storage/storage-types";

export type ShelvesSortOption = "alphabetical" | "createdAt" | "updatedAt";
export type ShelvesViewMode = "merged" | "grouped";

const MAX_COVERS = 4;

export interface GroupingWithMeta {
  grouping: Grouping;
  memberBookIds: string[];
  effectiveCreatedAt: number;
  effectiveUpdatedAt: number;
  covers: string[];
}

/**
 * A series has no create/rename/add/remove action of its own to stamp
 * createdAt/updatedAt on the Grouping row itself, so both are derived from
 * its member books' createdAt (earliest = created, latest = updated) —
 * see decision 3/4 of the Shelves tab spec. A collection uses its own
 * stored fields directly. Cover art is derived here too (member order,
 * capped at MAX_COVERS, skipping books with no cover) so downstream
 * consumers read a plain field instead of recomputing it per render.
 */
export function buildGroupingsWithMeta(
  groupings: Grouping[],
  membersByGrouping: Map<string, GroupingMember[]>,
  booksById: Map<string, StoredBook>,
): GroupingWithMeta[] {
  return groupings.map((grouping) => {
    const members = membersByGrouping.get(grouping.id) ?? [];
    const memberBookIds = members.map((member) => member.bookId);
    const covers = memberBookIds
      .map((bookId) => booksById.get(bookId)?.coverBg)
      .filter((url): url is string => !!url)
      .slice(0, MAX_COVERS);

    if (grouping.type === "collection") {
      return {
        grouping,
        memberBookIds,
        effectiveCreatedAt: grouping.createdAt,
        effectiveUpdatedAt: grouping.updatedAt,
        covers,
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
      covers,
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
