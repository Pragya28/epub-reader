import type { StoredBook } from "@/services/storage/storage-types";
import { clampPercent } from "@/utils/percent";
import type { BookWithProgress, ReadingStatus } from "../types/library.types";

/** A book counts as "New" if it hasn't been opened yet and was imported recently. */
const NEW_BOOK_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/** Consider a book finished once it's on the last chapter and near its end. */
const FINISHED_SCROLL_FRACTION_THRESHOLD = 0.98;

/**
 * True for a book that's never actually been opened — either no progress
 * row at all, or the full progress object import-book.ts seeds at import
 * time (chapterIndex 0, scrollFraction 0, atDocumentEnd false), which is
 * indistinguishable from "unread" by any real signal. Without this,
 * deriveReadingStatus's `!progress` check never fires (import always seeds
 * a progress object) and every freshly imported multi-chapter book reads
 * as "reading" from the moment it's imported.
 */
function isUntouchedProgress(
  progress: StoredBook["progress"],
): progress is undefined {
  return (
    !progress ||
    (progress.chapterIndex === 0 &&
      progress.scrollFraction === 0 &&
      progress.atDocumentEnd !== true)
  );
}

/**
 * The one "is this book finished" decision, shared by the library's saved-
 * progress status and the reader's live next-book check. Callers decide
 * what "reached the end" means from the signals they have (the library
 * has atDocumentEnd/scrollFraction; the reader only has the live percent).
 *
 * percent is a book-wide, word-count-weighted figure, independent of
 * chapter position — on a book whose literal last chapter is tiny (an
 * "End Notes"/acknowledgments page), it can already reach 100 while the
 * chapter index is still one short of the last (e.g. "17 of 18"). So 100
 * counts as finished unconditionally, before the last-chapter gate.
 * Clamped, not trusted outright — a value saved before computeReaderProgress's
 * own clamp existed, or carried in from a backup/import, isn't guaranteed to
 * be in 0-100 range, and an out-of-range value would wrongly mark the book
 * "finished".
 */
export function isProgressFinished(
  chapterIndex: number,
  totalChapters: number,
  percent: number,
  reachedEnd: boolean,
): boolean {
  if (clampPercent(percent) >= 100) return true;
  return chapterIndex >= totalChapters - 1 && reachedEnd;
}

function deriveReadingStatus(
  progress: StoredBook["progress"],
  manualStatus?: StoredBook["manualStatus"],
): ReadingStatus {
  if (manualStatus) return manualStatus;

  if (isUntouchedProgress(progress)) return "unread";

  // atDocumentEnd is the reliable signal — it's a document-level check,
  // not dependent on measuring the last chapter's own section height,
  // so it doesn't undershoot on a short epilogue/acknowledgments
  // chapter that's shorter than the viewport (scrollFraction alone
  // could never reach the threshold in that case even at the book's
  // literal last pixel). scrollFraction stays as a fallback for older
  // saved progress written before atDocumentEnd existed, or any case
  // where the document-height check behaves unexpectedly.
  const reachedEnd =
    progress.atDocumentEnd === true ||
    progress.scrollFraction >= FINISHED_SCROLL_FRACTION_THRESHOLD;

  return isProgressFinished(
    progress.chapterIndex,
    progress.totalChapters,
    progress.percent,
    reachedEnd,
  )
    ? "finished"
    : "reading";
}

/**
 * Picks the library screen's banner candidate: the most recently read
 * book that's either still in progress or was just finished. Real data
 * from progress.updatedAt, not just "the first matching book found" in
 * whatever order books arrived. The caller decides what to render based
 * on isReading vs. isFinished — a finished pick surfaces "next in
 * series" instead of "continue reading" the same book.
 */
export function pickCurrentlyReadingBook(
  books: BookWithProgress[],
): BookWithProgress | null {
  return (
    [...books]
      .filter((book) => book.isReading || book.isFinished)
      .sort(
        (a, b) => (b.progressUpdatedAt ?? 0) - (a.progressUpdatedAt ?? 0),
      )[0] ?? null
  );
}

export function enrichBookWithProgress(book: StoredBook): BookWithProgress {
  const status = deriveReadingStatus(book.progress, book.manualStatus);

  // isNew needs "untouched", not status === "unread": a book manually reset
  // to unread via "Mark as Unread" also derives status "unread" but isn't a
  // new import, so manualStatus is excluded here on top of the progress check.
  const untouched = !book.manualStatus && isUntouchedProgress(book.progress);

  return {
    ...book,
    status,
    isFinished: status === "finished",
    isReading: status === "reading",
    progress:
      book.progress?.percent !== undefined
        ? clampPercent(book.progress.percent)
        : undefined,
    progressUpdatedAt: book.progress?.updatedAt,
    chapterIndex: book.progress?.chapterIndex,
    totalChapters: book.progress?.totalChapters,
    isNew: untouched && Date.now() - book.createdAt < NEW_BOOK_WINDOW_MS,
  };
}
