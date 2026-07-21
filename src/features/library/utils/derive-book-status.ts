import type { StoredBook } from "@/services/storage/storage-types";
import type { BookWithProgress, ReadingStatus } from "../types/library.types";

/** A book counts as "New" if it hasn't been opened yet and was imported recently. */
const NEW_BOOK_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/** Consider a book finished once it's on the last chapter and near its end. */
const FINISHED_SCROLL_FRACTION_THRESHOLD = 0.98;

function deriveReadingStatus(progress: StoredBook["progress"]): ReadingStatus {
  if (!progress) return "unread";

  const isLastChapter = progress.chapterIndex >= progress.totalChapters - 1;
  const isNearEnd =
    progress.scrollFraction >= FINISHED_SCROLL_FRACTION_THRESHOLD;

  if (isLastChapter && isNearEnd) return "finished";

  return "reading";
}

export function enrichBookWithProgress(book: StoredBook): BookWithProgress {
  const status = deriveReadingStatus(book.progress);

  return {
    ...book,
    status,
    progress: book.progress?.percent,
    progressUpdatedAt: book.progress?.updatedAt,
    chapterIndex: book.progress?.chapterIndex,
    totalChapters: book.progress?.totalChapters,
    isNew:
      status === "unread" && Date.now() - book.createdAt < NEW_BOOK_WINDOW_MS,
  };
}
