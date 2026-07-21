import { updateBookProgress } from "@/services/storage/book-repository";
import type { ReadingProgress } from "@/services/storage/storage-types";
import { logger as rootLogger } from "@/shared/logger/logger";

const logger = rootLogger.child("save-reader-progress");

/**
 * Persists reading progress. Best-effort: a failed write shouldn't
 * interrupt reading, so errors are logged and swallowed rather than
 * surfaced to the UI.
 */
export async function saveReaderProgress(
  bookId: string,
  progress: ReadingProgress,
): Promise<void> {
  try {
    await updateBookProgress(bookId, progress);
    logger.trace("progress saved", { bookId, progress });
  } catch (error) {
    logger.error("failed to save reading progress", error);
  }
}

interface ComputeProgressParams {
  iframeDoc: Document;
  win: Window;
  activeIndex: number;
  totalChapters: number;
}

/**
 * Derives a ReadingProgress snapshot from the current scroll state.
 * scrollFraction is measured relative to the active chapter's own
 * section height, so it degrades gracefully across reflows/font-size
 * changes rather than relying on an absolute pixel offset.
 */
export function computeReaderProgress({
  iframeDoc,
  win,
  activeIndex,
  totalChapters,
}: ComputeProgressParams): ReadingProgress {
  const section = iframeDoc.querySelector(
    `section[data-chapter="${activeIndex}"]`,
  ) as HTMLElement | null;

  let scrollFraction = 0;

  if (section) {
    const sectionHeight = section.scrollHeight || section.offsetHeight || 1;
    const offsetWithinSection = win.scrollY - section.offsetTop;
    scrollFraction = Math.min(
      1,
      Math.max(0, offsetWithinSection / sectionHeight),
    );
  }

  const percent =
    totalChapters > 0
      ? Math.min(
          100,
          Math.round(((activeIndex + scrollFraction) / totalChapters) * 100),
        )
      : 0;

  return {
    chapterIndex: activeIndex,
    totalChapters,
    scrollFraction,
    percent,
    updatedAt: Date.now(),
  };
}
