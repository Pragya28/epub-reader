import type { ParsedBook } from "@/services/epub/epub-types";
import type {
  ReadingProgress,
  StoredBook,
} from "@/services/storage/storage-types";

interface ReaderDocument {
  book: StoredBook;
  file: Blob;
}

export interface ReaderStore {
  readerDocument: ReaderDocument | null;
  parsedBook: ParsedBook | null;
  currentChapterIndex: number;
  isLoading: boolean;
  error: string | null;

  /** Chapter indices currently mounted in the iframe DOM. */
  loadedChapterIndices: Set<number>;
  /** True while a chapter mount/unmount is in progress (guards windowing). */
  isMountingChapter: boolean;
  /** True during a TOC/anchor jump — scroll engine ignores scroll events. */
  isJumping: boolean;
  /**
   * Reading progress as a 0–100 integer, derived from
   * (chapterIndex + scrollFraction) / totalChapters on every scroll tick.
   * More accurate than chapter-boundary snapping because it reflects the
   * user's actual position within the current chapter.
   */
  progressPercent: number;
  /** Positions to return to after an in-content (footnote/endnote) jump, most recent last. */
  footnoteBackStack: ReadingProgress[];

  setReaderDocument: (readerDocument: ReaderDocument | null) => void;
  setParsedBook: (parsedBook: ParsedBook | null) => void;
  setCurrentChapterIndex: (currentChapterIndex: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setProgressPercent: (progressPercent: number) => void;

  addLoadedChapterIndex: (index: number) => void;
  removeLoadedChapterIndex: (index: number) => void;
  setIsMountingChapter: (isMountingChapter: boolean) => void;
  setIsJumping: (isJumping: boolean) => void;
  pushFootnoteBackPosition: (progress: ReadingProgress) => void;
  popFootnoteBackPosition: () => void;

  reset: () => void;
}

export interface ReaderSession {
  book: StoredBook;
  currentChapterIndex: number;
  isLoading: boolean;
  error: string | null;
}
