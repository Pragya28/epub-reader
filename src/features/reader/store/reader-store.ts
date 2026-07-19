import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ReaderStore } from "../types/reader-types";

const initialState: Partial<ReaderStore> = {
  readerDocument: null,
  parsedBook: null,
  currentChapterIndex: 0,
  isLoading: false,
  error: null,
  loadedChapterIndices: new Set<number>(),
  isMountingChapter: false,
  isJumping: false,
};

export const readerStore = create<ReaderStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setReaderDocument: (readerDocument) =>
        set({ readerDocument }, false, "reader/setReaderDocument"),

      setParsedBook: (parsedBook) =>
        set({ parsedBook }, false, "reader/setParsedBook"),

      setCurrentChapterIndex: (currentChapterIndex) =>
        set({ currentChapterIndex }, false, "reader/setCurrentChapterIndex"),

      setLoading: (isLoading) => set({ isLoading }, false, "reader/setLoading"),

      setError: (error) => set({ error }, false, "reader/setError"),

      addLoadedChapterIndex: (index) =>
        set(
          (state) => ({
            loadedChapterIndices: new Set(state.loadedChapterIndices).add(
              index,
            ),
          }),
          false,
          "reader/addLoadedChapterIndex",
        ),

      removeLoadedChapterIndex: (index) =>
        set(
          (state) => {
            const next = new Set(state.loadedChapterIndices);
            next.delete(index);
            return { loadedChapterIndices: next };
          },
          false,
          "reader/removeLoadedChapterIndex",
        ),

      setIsMountingChapter: (isMountingChapter) =>
        set({ isMountingChapter }, false, "reader/setIsMountingChapter"),

      setIsJumping: (isJumping) =>
        set({ isJumping }, false, "reader/setIsJumping"),

      reset: () =>
        set(
          { ...initialState, loadedChapterIndices: new Set<number>() },
          false,
          "reader/reset",
        ),
    }),
    {
      name: "reader-store",
    },
  ),
);
