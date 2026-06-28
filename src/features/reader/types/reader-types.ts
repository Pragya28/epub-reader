import type { ParsedBook } from "@/services/epub/epub-types";
import type { StoredBook } from "@/services/storage/storage-types";

interface ReaderDocument {
  book: StoredBook;
  file: Blob;
}

export interface ReaderStore {
  document: ReaderDocument | null;
  parsedBook: ParsedBook | null;
  currentChapterIndex: number;
  isLoading: boolean;
  error: string | null;

  setDocument: (document: ReaderDocument) => void;
  setParsedBook: (book: ParsedBook) => void;
  setCurrentChapterIndex: (index: number) => void;
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
  reset: () => void;
}

export interface ReaderSession {
  book: StoredBook;
  currentChapterIndex: number;
  isLoading: boolean;
  error: string | null;
}
