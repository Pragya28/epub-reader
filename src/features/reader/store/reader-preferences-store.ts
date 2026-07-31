import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReaderTheme = "system" | "light" | "dark";

export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.6;
export const FONT_SCALE_STEP = 0.1;

export const LINE_HEIGHT_MIN = 1.2;
export const LINE_HEIGHT_MAX = 2.2;
export const LINE_HEIGHT_STEP = 0.1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface ReaderPreferencesStore {
  fontScale: number;
  lineHeight: number;
  theme: ReaderTheme;
  setFontScale: (value: number) => void;
  setLineHeight: (value: number) => void;
  setTheme: (value: ReaderTheme) => void;
}

export const readerPreferencesStore = create<ReaderPreferencesStore>()(
  persist(
    (set) => ({
      fontScale: 1,
      lineHeight: 1.6,
      theme: "system",

      setFontScale: (value) =>
        set({ fontScale: clamp(value, FONT_SCALE_MIN, FONT_SCALE_MAX) }),

      setLineHeight: (value) =>
        set({ lineHeight: clamp(value, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX) }),

      setTheme: (value) => set({ theme: value }),
    }),
    { name: "reader-preferences" },
  ),
);
