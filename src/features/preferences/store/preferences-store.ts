import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppTheme, ReaderFontId } from "../types/preferences.types";

export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.6;
export const FONT_SCALE_STEP = 0.1;

export const LINE_HEIGHT_MIN = 1.2;
export const LINE_HEIGHT_MAX = 2.2;
export const LINE_HEIGHT_STEP = 0.1;

export const MARGIN_MIN = 8;
export const MARGIN_MAX = 48;
export const MARGIN_STEP = 8;

export const PARAGRAPH_SPACING_MIN = 0;
export const PARAGRAPH_SPACING_MAX = 24;
export const PARAGRAPH_SPACING_STEP = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface PreferencesStore {
  /** User-level (app shell) theme. */
  theme: AppTheme;
  /** When true, the reader follows `theme` instead of its own `readerTheme`. */
  applyThemeToReader: boolean;
  /** Shared reading font — editable from Settings or the reader toolbar. */
  readerFont: ReaderFontId;

  /** Reader-only theme, used only when `applyThemeToReader` is false. */
  readerTheme: AppTheme;
  fontScale: number;
  lineHeight: number;
  /** Horizontal reading margin, in px. */
  margins: number;
  /** Space below each paragraph, in px. */
  paragraphSpacing: number;

  setTheme: (value: AppTheme) => void;
  setApplyThemeToReader: (value: boolean) => void;
  setReaderFont: (value: ReaderFontId) => void;
  setReaderTheme: (value: AppTheme) => void;
  setFontScale: (value: number) => void;
  setLineHeight: (value: number) => void;
  setMargins: (value: number) => void;
  setParagraphSpacing: (value: number) => void;
}

export const preferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      theme: "system",
      applyThemeToReader: true,
      readerFont: "literata",

      readerTheme: "system",
      fontScale: 1,
      lineHeight: 1.6,
      margins: 16,
      paragraphSpacing: 8,

      setTheme: (value) => set({ theme: value }),
      setApplyThemeToReader: (value) => set({ applyThemeToReader: value }),
      setReaderFont: (value) => set({ readerFont: value }),
      setReaderTheme: (value) => set({ readerTheme: value }),

      setFontScale: (value) =>
        set({ fontScale: clamp(value, FONT_SCALE_MIN, FONT_SCALE_MAX) }),

      setLineHeight: (value) =>
        set({ lineHeight: clamp(value, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX) }),

      setMargins: (value) =>
        set({ margins: clamp(value, MARGIN_MIN, MARGIN_MAX) }),

      setParagraphSpacing: (value) =>
        set({
          paragraphSpacing: clamp(
            value,
            PARAGRAPH_SPACING_MIN,
            PARAGRAPH_SPACING_MAX,
          ),
        }),
    }),
    { name: "librune-preferences" },
  ),
);

/** The theme the reader should actually render, resolving the "apply to reader" toggle. */
export function getEffectiveReaderTheme(
  state: Pick<PreferencesStore, "applyThemeToReader" | "theme" | "readerTheme">,
): AppTheme {
  return state.applyThemeToReader ? state.theme : state.readerTheme;
}

/** The exact shape the reader iframe needs — resolves `getEffectiveReaderTheme` once. */
export function selectEffectiveReaderPreferences(state: PreferencesStore): {
  fontScale: number;
  lineHeight: number;
  theme: AppTheme;
  font: ReaderFontId;
  margins: number;
  paragraphSpacing: number;
} {
  return {
    fontScale: state.fontScale,
    lineHeight: state.lineHeight,
    theme: getEffectiveReaderTheme(state),
    font: state.readerFont,
    margins: state.margins,
    paragraphSpacing: state.paragraphSpacing,
  };
}
