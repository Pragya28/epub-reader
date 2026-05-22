import { create } from "zustand";
import type { LibraryStore } from "../types/library.types";

export const useLibraryStore = create<LibraryStore>((set) => ({
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
}));
