import type { StoredBook } from "@/services/storage/storage-types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ReaderStore } from "../types/reader-types";

const initialState = {
  book: null,
  currentChapterIndex: 0,
  isLoading: false,
  error: null,
};

export const readerStore = create<ReaderStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setDocument: (document) => set({ document }, false, "reader/setBook"),

      setCurrentChapterIndex: (currentChapterIndex) =>
        set({ currentChapterIndex }, false, "reader/setCurrentChapterIndex"),

      setLoading: (isLoading) => set({ isLoading }, false, "reader/setLoading"),

      setError: (error) => set({ error }, false, "reader/setError"),

      reset: () => set(initialState, false, "reader/reset"),
    }),
    {
      name: "reader-store",
    },
  ),
);
