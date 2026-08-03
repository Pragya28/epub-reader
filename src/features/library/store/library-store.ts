import { devtools } from "zustand/middleware";
import type { LibraryStore } from "../types/library.types";
import { create } from "zustand";

export const libraryStore = create<LibraryStore>()(
  devtools(
    (set) => ({
      books: [],
      isLoading: false,
      error: null,

      setBooks: (books) => set({ books }, false, "library/setBooks"),

      addBook: (book) =>
        set(
          (state) => ({
            books: [book, ...state.books],
          }),
          false,
          "library/addBook",
        ),

      removeBook: (bookId) =>
        set(
          (state) => ({
            books: state.books.filter((b) => b.id !== bookId),
          }),
          false,
          "library/removeBook",
        ),

      setLoading: (value) =>
        set({ isLoading: value }, false, "library/setLoading"),

      setError: (value) => set({ error: value }, false, "library/setError"),
    }),
    { name: "library-store" },
  ),
);
