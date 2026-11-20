import { isProgressFinished } from "@/features/library/utils/derive-book-status";

/** Mirrors derive-book-status.ts's FINISHED_SCROLL_FRACTION_THRESHOLD (0.98),
 * on the 0-100 percent scale the reader's progressPercent uses. */
const FINISHED_PROGRESS_PERCENT_THRESHOLD = 98;

/**
 * Whether the reader has reached the book's end. The reader only has the live
 * book-wide percent (no atDocumentEnd/scrollFraction), so "reached the end" is
 * percent >= 98; the finished decision itself is shared with the library.
 */
export function isBookFinished(
  currentChapterIndex: number,
  totalChapters: number,
  progressPercent: number,
): boolean {
  if (totalChapters <= 0) return false;
  return isProgressFinished(
    currentChapterIndex,
    totalChapters,
    progressPercent,
    progressPercent >= FINISHED_PROGRESS_PERCENT_THRESHOLD,
  );
}
