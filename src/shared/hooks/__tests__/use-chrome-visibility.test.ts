import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChromeVisibility } from "../use-chrome-visibility";

describe("useChromeVisibility", () => {
  it("starts visible", () => {
    const { result } = renderHook(() => useChromeVisibility());
    expect(result.current.visible).toBe(true);
  });

  it("hides on scroll down and reveals on scroll up", () => {
    const { result } = renderHook(() => useChromeVisibility());

    act(() => result.current.handleScrollDirection("down"));
    expect(result.current.visible).toBe(false);

    act(() => result.current.handleScrollDirection("up"));
    expect(result.current.visible).toBe(true);
  });

  it("toggles on tap", () => {
    const { result } = renderHook(() => useChromeVisibility());

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(true);
  });

  it("forces visible and ignores scroll/tap while an overlay is open", () => {
    const { result } = renderHook(() => useChromeVisibility());

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
    const { result } = renderHook(() => useChromeVisibility());

    act(() => result.current.setOverlay(true));
    act(() => result.current.setOverlay(false));
    act(() => result.current.handleScrollDirection("down"));

    expect(result.current.visible).toBe(false);
  });

  it("keeps callback identities stable across overlay open/close", () => {
    // useReaderEngine's effect depends on these; when they changed identity
    // on every sheet open/close the engine re-ran and wiped the iframe.
    const { result } = renderHook(() => useChromeVisibility());
    const before = result.current;

    act(() => result.current.setOverlay(true));
    act(() => result.current.setOverlay(false));

    expect(result.current.handleScrollDirection).toBe(
      before.handleScrollDirection,
    );
    expect(result.current.toggle).toBe(before.toggle);
    expect(result.current.setOverlay).toBe(before.setOverlay);
  });
});
