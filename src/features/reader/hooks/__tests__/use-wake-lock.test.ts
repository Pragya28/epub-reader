import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "../use-wake-lock";
import { preferencesStore } from "@/features/preferences/store/preferences-store";

interface FakeSentinel {
  release: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  /** Simulate the browser releasing the lock on its own (tab hidden, low battery). */
  fireRelease: () => void;
}

function installWakeLock() {
  const sentinels: FakeSentinel[] = [];
  const request = vi.fn(async () => {
    let onRelease: (() => void) | undefined;
    const sentinel: FakeSentinel = {
      release: vi.fn(async () => {}),
      addEventListener: vi.fn((type: string, cb: () => void) => {
        if (type === "release") onRelease = cb;
      }),
      fireRelease: () => onRelease?.(),
    };
    sentinels.push(sentinel);
    return sentinel as unknown as WakeLockSentinel;
  });
  Object.defineProperty(navigator, "wakeLock", {
    value: { request },
    configurable: true,
  });
  return { request, sentinels };
}

function removeWakeLock() {
  // @ts-expect-error — deleting an optional API for the unsupported-path test
  delete navigator.wakeLock;
}

beforeEach(() => {
  preferencesStore.setState({
    keepScreenAwake: true,
    keepScreenAwakeMinutes: 20,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  removeWakeLock();
});

describe("useWakeLock", () => {
  it("acquires a screen lock on mount when enabled", async () => {
    const { request } = installWakeLock();
    await act(async () => {
      renderHook(() => useWakeLock());
    });
    expect(request).toHaveBeenCalledWith("screen");
  });

  it("does nothing when the preference is off", async () => {
    preferencesStore.setState({ keepScreenAwake: false });
    const { request } = installWakeLock();
    await act(async () => {
      renderHook(() => useWakeLock());
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("is a silent no-op when the API is unsupported", async () => {
    removeWakeLock();
    const { result } = renderHook(() => useWakeLock());
    await act(async () => {
      result.current.notifyActivity();
    });
    // no throw is the assertion
    expect(result.current.notifyActivity).toBeTypeOf("function");
  });

  it("releases the lock on unmount", async () => {
    const { sentinels } = installWakeLock();
    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = renderHook(() => useWakeLock()));
    });
    expect(sentinels).toHaveLength(1);

    unmount();
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it("releases the lock when the preference is turned off", async () => {
    const { sentinels } = installWakeLock();
    await act(async () => {
      renderHook(() => useWakeLock());
    });

    await act(async () => {
      preferencesStore.setState({ keepScreenAwake: false });
    });

    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it("auto-releases after the configured minutes with no activity", async () => {
    vi.useFakeTimers();
    const { sentinels } = installWakeLock();
    await act(async () => {
      renderHook(() => useWakeLock());
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20 * 60_000 + 1);
    });

    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it("notifyActivity resets the auto-release timer", async () => {
    vi.useFakeTimers();
    const { sentinels } = installWakeLock();
    let result!: { current: { notifyActivity: () => void } };
    await act(async () => {
      ({ result } = renderHook(() => useWakeLock()));
    });

    // 15 min in, still held; a tap resets the countdown.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
      result.current.notifyActivity();
    });
    expect(sentinels[0].release).not.toHaveBeenCalled();

    // Another 15 min (30 total, but only 15 since the tap) — still held.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
    });
    expect(sentinels[0].release).not.toHaveBeenCalled();

    // Past the 20-min window from the tap — now released.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6 * 60_000);
    });
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it("re-acquires when the tab becomes visible again", async () => {
    const { request, sentinels } = installWakeLock();
    await act(async () => {
      renderHook(() => useWakeLock());
    });
    expect(request).toHaveBeenCalledTimes(1);

    // Simulate the browser's auto-release on hide, then a return to visible.
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    await act(async () => {
      sentinels[0].fireRelease();
      document.dispatchEvent(new Event("visibilitychange"));
    });

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(request).toHaveBeenCalledTimes(2);
  });
});
