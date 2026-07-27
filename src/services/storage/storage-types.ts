export interface ReadingProgress {
  /** Index of the chapter the reader was in when this was saved. */
  chapterIndex: number;
  /** Total chapter count at save time (books don't change, but kept for display without reparsing). */
  totalChapters: number;
  /** 0-1 scroll position within the chapterIndex section (clamped). */
  scrollFraction: number;
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
