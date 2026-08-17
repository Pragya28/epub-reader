import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ReaderStore } from "../types/reader-types";

const initialState: Pick<
  ReaderStore,
  | "readerDocument"
  | "parsedBook"
  | "currentChapterIndex"
  | "isLoading"
  | "error"
  | "loadedChapterIndices"
  | "isMountingChapter"
  | "isJumping"
  | "progressPercent"
  | "footnoteBackStack"
> = {
  readerDocument: null,
  parsedBook: null,
  currentChapterIndex: 0,
  isLoading: false,
  error: null,
  loadedChapterIndices: new Set<number>(),
  isMountingChapter: false,
  isJumping: false,
  progressPercent: 0,
  footnoteBackStack: [],
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

      setProgressPercent: (progressPercent) =>
        set({ progressPercent }, false, "reader/setProgressPercent"),

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

      pushFootnoteBackPosition: (progress) =>
        set(
          (state) => ({
            footnoteBackStack: [...state.footnoteBackStack, progress],
          }),
          false,
          "reader/pushFootnoteBackPosition",
        ),

      popFootnoteBackPosition: () =>
        set(
          (state) => ({
            footnoteBackStack: state.footnoteBackStack.slice(0, -1),
          }),
          false,
          "reader/popFootnoteBackPosition",
        ),

      reset: () =>
        set(
          {
            ...initialState,
            loadedChapterIndices: new Set<number>(),
            footnoteBackStack: [],
          },
          false,
          "reader/reset",
        ),
    }),
    {
      name: "reader-store",
    },
  ),
);
