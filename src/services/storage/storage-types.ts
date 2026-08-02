export interface ReadingProgress {
  /** Index of the chapter the reader was in when this was saved. */
  chapterIndex: number;
  /** Total chapter count at save time (books don't change, but kept for display without reparsing). */
  totalChapters: number;
  /** 0-1 scroll position within the chapterIndex section (clamped). */
  scrollFraction: number;
  /**
   * Path of child indices from the chapter section down to the content
   * block (paragraph, heading, list item, ...) the reader was at, used to
   * restore position by element instead of raw scroll fraction — survives
   * reflow (viewport/font changes) that would otherwise shift a pixel-based
   * restore. Null when no suitable block was found; absent entirely on
   * progress saved before this field existed. scrollFraction is the
   * fallback in both cases. See scroll-anchor.ts.
   */
  anchorPath?: number[] | null;
  /**
   * True when win.scrollY + viewport had reached the bottom of the
   * currently mounted document at save time. ONLY meaningful as a
   * "reached the end of the book" signal when chapterIndex is the last
   * chapter — chapter windowing unmounts far-away chapters, so on any
   * other chapter this just reflects wherever windowing happened to cut
   * off, not the book's actual end. See deriveReadingStatus, which is
   * the only place this should be interpreted.
   */
  atDocumentEnd: boolean;
  /** 0-100 overall book progress estimate, chapter-granularity + in-chapter fraction. */
  percent: number;
  updatedAt: number;
}

export interface StoredBook {
  id: string;
  title: string;
  author?: string;
  language?: string | null;
  description?: string | null;
  chapterCount?: number;
  wordCount?: number;
  readingTimeMinutes?: number;
  createdAt: number;
  fileHash: string;
  coverBg?: string;
  progress?: ReadingProgress;
  manualStatus?: "finished" | "unread";
}

export interface StoredBookFile {
  bookId: string;
  file: Blob;
}

export interface StoredBookCover {
  bookId: string;
  cover: Blob;
}
