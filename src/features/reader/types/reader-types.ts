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

  setReaderDocument: (readerDocument: ReaderDocument | null) => void;
  setParsedBook: (parsedBook: ParsedBook | null) => void;
  setCurrentChapterIndex: (currentChapterIndex: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export interface ReaderSession {
  book: StoredBook;
  currentChapterIndex: number;
  isLoading: boolean;
  error: string | null;
}
