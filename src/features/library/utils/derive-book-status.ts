import type { StoredBook } from "@/services/storage/storage-types";
import type { BookWithProgress, ReadingStatus } from "../types/library.types";

/** A book counts as "New" if it hasn't been opened yet and was imported recently. */
const NEW_BOOK_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/** Consider a book finished once it's on the last chapter and near its end. */
const FINISHED_SCROLL_FRACTION_THRESHOLD = 0.98;

function deriveReadingStatus(
  progress: StoredBook["progress"],
  manualStatus?: StoredBook["manualStatus"],
): ReadingStatus {
  if (manualStatus) return manualStatus;

  if (!progress) return "unread";

  const isLastChapter = progress.chapterIndex >= progress.totalChapters - 1;
  if (!isLastChapter) return "reading";

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

  return reachedEnd ? "finished" : "reading";
}

export function enrichBookWithProgress(book: StoredBook): BookWithProgress {
  const status = deriveReadingStatus(book.progress, book.manualStatus);

  return {
    ...book,
    status,
    isFinished: status === "finished",
    isReading: status === "reading",
    progress: book.progress?.percent,
    progressUpdatedAt: book.progress?.updatedAt,
    chapterIndex: book.progress?.chapterIndex,
    totalChapters: book.progress?.totalChapters,
    isNew:
      status === "unread" && Date.now() - book.createdAt < NEW_BOOK_WINDOW_MS,
  };
}
