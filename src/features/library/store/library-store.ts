import type { LibraryStore } from "../types/library.types";
import { createStore } from "@/stores/create-store";

export const useLibraryStore = createStore<LibraryStore>(
  (set) => ({
    books: [],
    isLoading: false,
    error: null,
    setBooks: (books) => set({ books }),
    addBook: (book) =>
      set((state) => ({
        books: [book, ...state.books],
      })),
    setLoading: (value) => set({ isLoading: value }),
    setError: (value) => set({ error: value }),
  }),
  { name: "library-store" },
);
