import type { StoredBook } from "@/services/storage/storage-types";

export interface LibraryStore {
  books: StoredBook[];
  isLoading: boolean;
  error: string | null;
  setBooks: (books: StoredBook[]) => void;
  addBook: (book: StoredBook) => void;
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
}

export type ReadingStatus = "reading" | "unread" | "finished";

export interface BookWithProgress extends StoredBook {
  progress?: number; // 0-100
  status: ReadingStatus;
  isNew?: boolean;
  coverBg?: string;
}
