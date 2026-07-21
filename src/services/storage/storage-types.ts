export interface ReadingProgress {
  /** Index of the chapter the reader was in when this was saved. */
  chapterIndex: number;
  /** Total chapter count at save time (books don't change, but kept for display without reparsing). */
  totalChapters: number;
  /** 0-1 scroll position within the chapterIndex section (clamped). */
  scrollFraction: number;
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
}

export interface StoredBookFile {
  bookId: string;
  file: Blob;
}

export interface StoredBookCover {
  bookId: string;
  cover: Blob;
}
