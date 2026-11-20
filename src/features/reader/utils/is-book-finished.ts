/** Mirrors derive-book-status.ts's FINISHED_SCROLL_FRACTION_THRESHOLD (0.98),
 * on the 0-100 percent scale the reader's progressPercent uses. */
const FINISHED_PROGRESS_PERCENT_THRESHOLD = 98;

/**
 * Whether the reader has reached the book's end, matching the library's
 * "finished" status (derive-book-status.ts). Finished means near the end of
 * the last chapter, or 100% anywhere — a tiny trailing "End Notes" page can
 * push the word-weighted percent to 100 one chapter early.
 */
export function isBookFinished(
  currentChapterIndex: number,
  totalChapters: number,
  progressPercent: number,
): boolean {
  if (totalChapters <= 0) return false;
  if (progressPercent >= 100) return true;
  return (
    currentChapterIndex >= totalChapters - 1 &&
    progressPercent >= FINISHED_PROGRESS_PERCENT_THRESHOLD
  );
}
