import { beforeEach, describe, expect, it, vi } from "vitest";
import { toastStore } from "../toast-store";

describe("toast store", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    toastStore.setState({
      toasts: [],
    });
  });

  it("shows success toast", () => {
    toastStore.getState().showSuccess("Book imported");

    const { toasts } = toastStore.getState();

    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      message: "Book imported",
      type: "success",
    });
  });

  it("shows error toast", () => {
    toastStore.getState().showError("Import failed");

    const { toasts } = toastStore.getState();

    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      message: "Import failed",
      type: "error",
    });
  });

  it("removes toast manually", () => {
    toastStore.getState().showSuccess("Book imported");

    const toastId = toastStore.getState().toasts[0].id;

    toastStore.getState().removeToast(toastId);

    expect(toastStore.getState().toasts).toHaveLength(0);
  });

  it("auto removes success toast", () => {
    toastStore.getState().showSuccess("Book imported");

    expect(toastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(3000);

    expect(toastStore.getState().toasts).toHaveLength(0);
  });

  it("auto removes error toast", () => {
    toastStore.getState().showError("Import failed");

    expect(toastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(4000);

    expect(toastStore.getState().toasts).toHaveLength(0);
  });
});
