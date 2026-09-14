import type { StoredBook } from "@/services/storage/storage-types";
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

function deriveReadingStatus(
  progress: StoredBook["progress"],
  manualStatus?: StoredBook["manualStatus"],
): ReadingStatus {
  if (manualStatus) return manualStatus;

  if (isUntouchedProgress(progress)) return "unread";

  const isLastChapter = progress.chapterIndex >= progress.totalChapters - 1;
  if (!isLastChapter) return "reading";

  // atDocumentEnd is the reliable signal — it's a document-level check,
  // not dependent on measuring the last chapter's own section height,
  // so it doesn't undershoot on a short epilogue/acknowledgments
  // chapter that's shorter than the viewport (scrollFraction alone
  // could never reach the threshold in that case even at the book's
  // literal last pixel). scrollFraction stays as a fallback for older
  // saved progress written before atDocumentEnd existed, or any case
  // where the document-height check behaves unexpectedly. percent is a
  // book-wide, word-count-weighted figure computed independently of
  // scrollFraction/atDocumentEnd — on a short final chapter it can round
  // up to 100 while this chapter's own scrollFraction is still under
  // threshold, so it's checked too rather than leaving a visible "100%"
  // book stuck as "reading".
  const reachedEnd =
    progress.atDocumentEnd === true ||
    progress.scrollFraction >= FINISHED_SCROLL_FRACTION_THRESHOLD ||
    progress.percent >= 100;

  return reachedEnd ? "finished" : "reading";
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
    progress: book.progress?.percent,
    progressUpdatedAt: book.progress?.updatedAt,
    chapterIndex: book.progress?.chapterIndex,
    totalChapters: book.progress?.totalChapters,
    isNew: untouched && Date.now() - book.createdAt < NEW_BOOK_WINDOW_MS,
  };
}
