import { libraryStore } from "@/features/library/store/library-store";
import { updateBookProgress } from "@/services/storage/book-repository";
import type { ReadingProgress } from "@/services/storage/storage-types";
import { logger as rootLogger } from "@/shared/logger/logger";
import { computeScrollAnchor } from "../engine/scroll/scroll-anchor";
import { postProgressUpdate } from "../utils/reading-progress-channel";

const logger = rootLogger.child("save-reader-progress");

/**
 * Prefix-sums per-chapter word counts into cumulative offsets (length
 * chapterWordCounts.length + 1, last entry is the book total) — call once
 * per book load and reuse, rather than re-summing on every progress
 * computation. See ComputeProgressParams.chapterWordOffsets.
 */
export function computeChapterWordOffsets(
  chapterWordCounts: number[],
): number[] {
  const offsets = [0];
  for (const count of chapterWordCounts) {
    offsets.push(offsets[offsets.length - 1] + count);
  }
  return offsets;
}

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
    postProgressUpdate(bookId, progress);
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
  /**
   * Cumulative word count before each chapter, length totalChapters + 1
   * (last entry is the book's total word count) — see
   * computeChapterWordOffsets. Precomputed once per book load so percent
   * is an O(1) lookup here instead of re-summing chapter counts on every
   * scroll tick. When present, percent is computed from word offset
   * instead of chapter-granularity + in-chapter fraction.
   */
  chapterWordOffsets?: number[];
  /**
   * Compute `anchorPath` (a DOM walk + getBoundingClientRect loop over every
   * block scrolled past). Skip it on the per-scroll-frame call that only needs
   * `percent`; only the debounced save actually persists the anchor.
   */
  includeAnchor?: boolean;
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
  chapterWordOffsets,
  includeAnchor = true,
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
    if (includeAnchor) anchorPath = computeScrollAnchor(section);
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

  const totalWordCount = chapterWordOffsets?.[totalChapters];

  const wordOffset =
    chapterWordOffsets && chapterWordOffsets.length === totalChapters + 1
      ? chapterWordOffsets[activeIndex] +
        effectiveFraction *
          (chapterWordOffsets[activeIndex + 1] -
            chapterWordOffsets[activeIndex])
      : undefined;

  const percent =
    wordOffset !== undefined && totalWordCount
      ? Math.min(100, Math.round((wordOffset / totalWordCount) * 100))
      : totalChapters > 0
        ? Math.min(
            100,
            Math.round(
              ((activeIndex + effectiveFraction) / totalChapters) * 100,
            ),
          )
        : 0;

  return {
    chapterIndex: activeIndex,
    totalChapters,
    scrollFraction: effectiveFraction,
    anchorPath,
    atDocumentEnd,
    percent,
    wordOffset,
    updatedAt: Date.now(),
  };
}
