import type { StoredBook } from "@/services/storage/storage-types";

export interface LibraryStore {
  books: StoredBook[];
  isLoading: boolean;
  error: string | null;
  setBooks: (books: StoredBook[]) => void;
  addBook: (book: StoredBook) => void;
  removeBook: (bookId: string) => void;
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
}

export type ReadingStatus = "reading" | "unread" | "finished";

export interface BookWithProgress extends Omit<StoredBook, "progress"> {
  progress?: number; // 0-100, mirrors StoredBook.progress.percent
  progressUpdatedAt?: number; // mirrors StoredBook.progress.updatedAt
  chapterIndex?: number; // mirrors StoredBook.progress.chapterIndex
  totalChapters?: number; // mirrors StoredBook.progress.totalChapters
  status: ReadingStatus;
  isNew?: boolean;
  isFinished?: boolean;
  isReading?: boolean;
  coverBg?: string;
}
