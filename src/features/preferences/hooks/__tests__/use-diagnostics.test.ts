import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagnostics } from "../use-diagnostics";
import { clearErrorLog, recordError } from "@/shared/logger/error-log";
import { notify } from "@/components/toast/toast";

vi.mock("@/components/toast/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function stubNavigatorShare(value: Partial<Navigator> | undefined) {
  for (const key of ["share", "canShare"] as const) {
    Object.defineProperty(navigator, key, {
      value: value?.[key],
      configurable: true,
      writable: true,
    });
  }
}

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
}

describe("useDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearErrorLog();
  });

  afterEach(() => {
    stubNavigatorShare(undefined);
  });

  it("reports the current error count", () => {
    recordError({ message: "one" });
    recordError({ message: "two" });

    const { result } = renderHook(() => useDiagnostics());

    expect(result.current.errorCount).toBe(2);
  });

  it("canShare is false when the Web Share API is unavailable", () => {
    stubNavigatorShare(undefined);

    const { result } = renderHook(() => useDiagnostics());

    expect(result.current.canShare).toBe(false);
  });

  it("canShare is true when navigator.share/canShare exist", () => {
    stubNavigatorShare({ share: vi.fn(), canShare: vi.fn() });

    const { result } = renderHook(() => useDiagnostics());

    expect(result.current.canShare).toBe(true);
  });

  it("copyErrorLog writes the JSON log to the clipboard and toasts success", async () => {
    recordError({ message: "one" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    const { result } = renderHook(() => useDiagnostics());
    await act(() => result.current.copyErrorLog());

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(JSON.parse(writeText.mock.calls[0][0])).toHaveLength(1);
    expect(notify.success).toHaveBeenCalled();
  });

  it("copyErrorLog toasts an error when the clipboard write fails", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));

    const { result } = renderHook(() => useDiagnostics());
    await act(() => result.current.copyErrorLog());

    expect(notify.error).toHaveBeenCalled();
  });

  it("shareErrorLog invokes navigator.share with a timestamped JSON file", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    stubNavigatorShare({ share, canShare });

    const { result } = renderHook(() => useDiagnostics());
    await act(() => result.current.shareErrorLog());

    expect(canShare).toHaveBeenCalled();
    expect(share).toHaveBeenCalledTimes(1);
    const [{ files }] = share.mock.calls[0];
    expect(files).toHaveLength(1);
    expect(files[0].name).toMatch(/^librune-error-log-.*\.json$/);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("shareErrorLog silently no-ops when the user cancels the share sheet", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("cancelled", "AbortError"));
    stubNavigatorShare({ share, canShare: vi.fn().mockReturnValue(true) });

    const { result } = renderHook(() => useDiagnostics());
    await act(() => result.current.shareErrorLog());

    expect(notify.error).not.toHaveBeenCalled();
  });
});
