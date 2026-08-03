import type { BookWithProgress, ReadingStatus } from "../types/library.types";

export type SortOption =
  | "recentlyOpened"
  | "recentlyImported"
  | "title"
  | "author"
  | "progress"
  | "status";

export const DEFAULT_SORT: SortOption = "recentlyImported";

const STATUS_ORDER: Record<ReadingStatus, number> = {
  reading: 0,
  unread: 1,
  finished: 2,
};

export function sortBooks(
  books: BookWithProgress[],
  sortBy: SortOption,
): BookWithProgress[] {
  const sorted = [...books];

  switch (sortBy) {
    case "recentlyOpened":
      return sorted.sort(
        (a, b) => (b.progressUpdatedAt ?? 0) - (a.progressUpdatedAt ?? 0),
      );
    case "recentlyImported":
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "author":
      return sorted.sort((a, b) =>
        (a.author ?? "").localeCompare(b.author ?? ""),
      );
    case "progress":
      return sorted.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
    case "status":
      return sorted.sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
      );
  }
}
