import { describe, expect, it, beforeEach } from "vitest";
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  readerPreferencesStore,
} from "../reader-preferences-store";

describe("readerPreferencesStore", () => {
  beforeEach(() => {
    readerPreferencesStore.setState({
      fontScale: 1,
      lineHeight: 1.6,
      theme: "system",
    });
  });

  it("has sane defaults", () => {
    const state = readerPreferencesStore.getState();
    expect(state.fontScale).toBe(1);
    expect(state.lineHeight).toBe(1.6);
    expect(state.theme).toBe("system");
  });

  it("updates fontScale within range", () => {
    readerPreferencesStore.getState().setFontScale(1.3);
    expect(readerPreferencesStore.getState().fontScale).toBe(1.3);
  });

  it("clamps fontScale to the allowed range", () => {
    readerPreferencesStore.getState().setFontScale(10);
    expect(readerPreferencesStore.getState().fontScale).toBe(FONT_SCALE_MAX);

    readerPreferencesStore.getState().setFontScale(-5);
    expect(readerPreferencesStore.getState().fontScale).toBe(FONT_SCALE_MIN);
  });

  it("clamps lineHeight to the allowed range", () => {
    readerPreferencesStore.getState().setLineHeight(10);
    expect(readerPreferencesStore.getState().lineHeight).toBe(LINE_HEIGHT_MAX);

    readerPreferencesStore.getState().setLineHeight(-5);
    expect(readerPreferencesStore.getState().lineHeight).toBe(LINE_HEIGHT_MIN);
  });

  it("updates the theme", () => {
    readerPreferencesStore.getState().setTheme("dark");
    expect(readerPreferencesStore.getState().theme).toBe("dark");
  });
});
