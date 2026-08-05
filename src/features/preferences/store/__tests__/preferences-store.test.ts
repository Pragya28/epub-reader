import { describe, expect, it, beforeEach } from "vitest";
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  MARGIN_MAX,
  MARGIN_MIN,
  PARAGRAPH_SPACING_MAX,
  PARAGRAPH_SPACING_MIN,
  getEffectiveReaderTheme,
  preferencesStore,
  selectEffectiveReaderPreferences,
} from "../preferences-store";

describe("preferencesStore", () => {
  beforeEach(() => {
    preferencesStore.setState({
      theme: "system",
      applyThemeToReader: true,
      readerFont: "literata",
      readerTheme: "system",
      fontScale: 1,
      lineHeight: 1.6,
      margins: 16,
      paragraphSpacing: 8,
    });
  });

  it("has sane defaults", () => {
    const state = preferencesStore.getState();
    expect(state.theme).toBe("system");
    expect(state.applyThemeToReader).toBe(true);
    expect(state.readerFont).toBe("literata");
    expect(state.fontScale).toBe(1);
    expect(state.lineHeight).toBe(1.6);
    expect(state.margins).toBe(16);
    expect(state.paragraphSpacing).toBe(8);
  });

  it("updates fontScale within range", () => {
    preferencesStore.getState().setFontScale(1.3);
    expect(preferencesStore.getState().fontScale).toBe(1.3);
  });

  it("clamps fontScale to the allowed range", () => {
    preferencesStore.getState().setFontScale(10);
    expect(preferencesStore.getState().fontScale).toBe(FONT_SCALE_MAX);

    preferencesStore.getState().setFontScale(-5);
    expect(preferencesStore.getState().fontScale).toBe(FONT_SCALE_MIN);
  });

  it("clamps lineHeight to the allowed range", () => {
    preferencesStore.getState().setLineHeight(10);
    expect(preferencesStore.getState().lineHeight).toBe(LINE_HEIGHT_MAX);

    preferencesStore.getState().setLineHeight(-5);
    expect(preferencesStore.getState().lineHeight).toBe(LINE_HEIGHT_MIN);
  });

  it("clamps margins to the allowed range", () => {
    preferencesStore.getState().setMargins(1000);
    expect(preferencesStore.getState().margins).toBe(MARGIN_MAX);

    preferencesStore.getState().setMargins(-5);
    expect(preferencesStore.getState().margins).toBe(MARGIN_MIN);
  });

  it("clamps paragraphSpacing to the allowed range", () => {
    preferencesStore.getState().setParagraphSpacing(1000);
    expect(preferencesStore.getState().paragraphSpacing).toBe(
      PARAGRAPH_SPACING_MAX,
    );

    preferencesStore.getState().setParagraphSpacing(-5);
    expect(preferencesStore.getState().paragraphSpacing).toBe(
      PARAGRAPH_SPACING_MIN,
    );
  });

  it("updates the user-level theme", () => {
    preferencesStore.getState().setTheme("dark");
    expect(preferencesStore.getState().theme).toBe("dark");
  });

  it("updates the reader font", () => {
    preferencesStore.getState().setReaderFont("lora");
    expect(preferencesStore.getState().readerFont).toBe("lora");
  });

  describe("getEffectiveReaderTheme", () => {
    it("follows the user-level theme when applyThemeToReader is true", () => {
      expect(
        getEffectiveReaderTheme({
          applyThemeToReader: true,
          theme: "dark",
          readerTheme: "light",
        }),
      ).toBe("dark");
    });

    it("follows readerTheme when applyThemeToReader is false", () => {
      expect(
        getEffectiveReaderTheme({
          applyThemeToReader: false,
          theme: "dark",
          readerTheme: "light",
        }),
      ).toBe("light");
    });
  });

  describe("selectEffectiveReaderPreferences", () => {
    it("resolves the iframe-facing preferences shape", () => {
      preferencesStore.setState({
        applyThemeToReader: false,
        theme: "dark",
        readerTheme: "light",
        readerFont: "atkinson",
        fontScale: 1.2,
        lineHeight: 1.8,
        margins: 24,
        paragraphSpacing: 12,
      });

      expect(
        selectEffectiveReaderPreferences(preferencesStore.getState()),
      ).toEqual({
        fontScale: 1.2,
        lineHeight: 1.8,
        theme: "light",
        font: "atkinson",
        margins: 24,
        paragraphSpacing: 12,
      });
    });
  });
});
