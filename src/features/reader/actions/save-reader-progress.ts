import { libraryStore } from "@/features/library/store/library-store";
import { updateBookProgress } from "@/services/storage/book-repository";
import type { ReadingProgress } from "@/services/storage/storage-types";
import { logger as rootLogger } from "@/shared/logger/logger";
import { computeScrollAnchor } from "../engine/scroll/scroll-anchor";

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
    libraryStore
      .getState()
      .setBooks(
        libraryStore
          .getState()
          .books.map((b) =>
            b.id === bookId ? { ...b, progress, manualStatus: undefined } : b,
          ),
      );
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
 * How close win.scrollY + viewport needs to be to the document's total
 * scrollHeight to count as "reached the end." A few px of tolerance
 * absorbs sub-pixel scroll rounding differences across browsers/DPI.
 */
const END_OF_DOCUMENT_TOLERANCE_PX = 4;

/**
 * Derives a ReadingProgress snapshot from the current scroll state.
 * scrollFraction is measured relative to the active chapter's own
 * section height, so it degrades gracefully across reflows/font-size
 * changes rather than relying on an absolute pixel offset — but it can
 * UNDERshoot 1 on a short last chapter/epilogue that's shorter than the
 * viewport, since the browser may never let scrollY reach a point where
 * the section-relative fraction crosses close to 1, even though the
 * user is at the document's literal end. atDocumentEnd is a second,
 * independent signal for exactly that case — see its doc comment in
 * storage-types.ts for why it's only meaningful on the last chapter.
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
  let anchorPath: number[] | null = null;

  if (section) {
    const sectionHeight = section.scrollHeight || section.offsetHeight || 1;
    const offsetWithinSection = win.scrollY - section.offsetTop;
    scrollFraction = Math.min(
      1,
      Math.max(0, offsetWithinSection / sectionHeight),
    );
    anchorPath = computeScrollAnchor(section);
  }

  const documentHeight = iframeDoc.documentElement?.scrollHeight ?? 0;
  const viewportHeight = win.innerHeight ?? 0;
  const atDocumentEnd =
    documentHeight > 0 &&
    win.scrollY + viewportHeight >=
      documentHeight - END_OF_DOCUMENT_TOLERANCE_PX;

  // If we've genuinely hit the bottom of the document, trust that over
  // the section-relative math rather than potentially reporting <100%
  // while the user is looking at the literal last pixel of the book.
  const effectiveFraction = atDocumentEnd ? 1 : scrollFraction;

  const percent =
    totalChapters > 0
      ? Math.min(
          100,
          Math.round(((activeIndex + effectiveFraction) / totalChapters) * 100),
        )
      : 0;

  return {
    chapterIndex: activeIndex,
    totalChapters,
    scrollFraction: effectiveFraction,
    anchorPath,
    atDocumentEnd,
    percent,
    updatedAt: Date.now(),
  };
}
