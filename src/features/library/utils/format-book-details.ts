import type { BookWithProgress } from "../types/library.types";

/**
 * "Not Started • 12 Chapters" / "Finished • 12 Chapters" / "4 / 12 Chapters".
 * Falls back to just the status word (no "• N Chapters" suffix) for books
 * imported before chapter count was tracked and never opened since, so
 * there's no `progress.totalChapters` to fall back on either. Returns null
 * when there's nothing at all to show (caller hides the row).
 */
export function formatReadingProgress(book: BookWithProgress): string | null {
  const totalChapters = book.chapterCount ?? book.totalChapters;

  if (book.status === "unread") {
    return totalChapters
      ? `Not Started • ${totalChapters} Chapters`
      : "Not Started";
  }

  if (book.status === "finished") {
    return totalChapters ? `Finished • ${totalChapters} Chapters` : "Finished";
  }

  if (!totalChapters) return null;

  const currentChapter = Math.min((book.chapterIndex ?? 0) + 1, totalChapters);

  return `${currentChapter} / ${totalChapters} Chapters`;
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min read`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes === 0
    ? `${hours} hr read`
    : `${hours} hr ${remainingMinutes} min read`;
}
