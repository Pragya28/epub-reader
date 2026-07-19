import type { ParsedBook } from "@/services/epub/epub-types";
import type { StoredBook } from "@/services/storage/storage-types";

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

  setReaderDocument: (readerDocument: ReaderDocument | null) => void;
  setParsedBook: (parsedBook: ParsedBook | null) => void;
  setCurrentChapterIndex: (currentChapterIndex: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  addLoadedChapterIndex: (index: number) => void;
  removeLoadedChapterIndex: (index: number) => void;
  setIsMountingChapter: (isMountingChapter: boolean) => void;
  setIsJumping: (isJumping: boolean) => void;

  reset: () => void;
}

export interface ReaderSession {
  book: StoredBook;
  currentChapterIndex: number;
  isLoading: boolean;
  error: string | null;
}
