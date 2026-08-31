import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImportBookFab } from "../use-import-book-fab";
import { notify } from "@/components/toast/toast";
import { importBook } from "../../actions/import-book";

vi.mock("../../actions/import-book", () => ({
  importBook: vi.fn(),
}));
vi.mock("../../actions/load-library", () => ({
  loadLibrary: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/components/toast/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

/** Picks up the `<input type="file">` `useImportBookFab` creates and
 * dispatches its `change` event with the given file, standing in for the
 * OS file-picker jsdom can't drive. */
function selectFile(file: File) {
  const input = document.body.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change"));
}

describe("useImportBookFab quota-exceeded messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a distinct message when the import write hits a real storage quota", async () => {
    vi.mocked(importBook).mockRejectedValueOnce(
      new DOMException("quota", "QuotaExceededError"),
    );

    const { result } = renderHook(() => useImportBookFab(), { wrapper });
    const file = new File(["x"], "book.epub", {
      type: "application/epub+zip",
    });

    const importPromise = act(() => result.current.handleImportOne());
    selectFile(file);
    await importPromise;

    expect(notify.error).toHaveBeenCalledWith(
      'Ran out of storage space while importing "book.epub". Free up space and try again.',
    );
  });

  it("falls back to a generic message for a non-quota import failure", async () => {
    vi.mocked(importBook).mockRejectedValueOnce(new Error("broken zip"));

    const { result } = renderHook(() => useImportBookFab(), { wrapper });
    const file = new File(["x"], "book.epub", {
      type: "application/epub+zip",
    });

    const importPromise = act(() => result.current.handleImportOne());
    selectFile(file);
    await importPromise;

    expect(notify.error).toHaveBeenCalledWith(
      'Couldn\'t import "book.epub": broken zip',
    );
  });
});
