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
