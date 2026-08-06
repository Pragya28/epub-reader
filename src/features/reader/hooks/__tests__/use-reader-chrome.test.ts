import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useReaderChrome } from "../use-reader-chrome";

describe("useReaderChrome", () => {
  it("starts visible", () => {
    const { result } = renderHook(() => useReaderChrome());
    expect(result.current.visible).toBe(true);
  });

  it("hides on scroll down and reveals on scroll up", () => {
    const { result } = renderHook(() => useReaderChrome());

    act(() => result.current.handleScrollDirection("down"));
    expect(result.current.visible).toBe(false);

    act(() => result.current.handleScrollDirection("up"));
    expect(result.current.visible).toBe(true);
  });

  it("toggles on tap", () => {
    const { result } = renderHook(() => useReaderChrome());

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(true);
  });

  it("forces visible and ignores scroll/tap while an overlay is open", () => {
    const { result } = renderHook(() => useReaderChrome());

    act(() => result.current.handleScrollDirection("down"));
    expect(result.current.visible).toBe(false);

    act(() => result.current.setOverlay(true));
    expect(result.current.visible).toBe(true);

    act(() => result.current.handleScrollDirection("down"));
    expect(result.current.visible).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(true);
  });

  it("resumes scroll/tap-driven visibility once the overlay closes", () => {
    const { result } = renderHook(() => useReaderChrome());

    act(() => result.current.setOverlay(true));
    act(() => result.current.setOverlay(false));
    act(() => result.current.handleScrollDirection("down"));

    expect(result.current.visible).toBe(false);
  });
});
