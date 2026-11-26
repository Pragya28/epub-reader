import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useGroupingBooks } from "../use-grouping-books";
import { loadLibrary } from "../../actions/load-library";
import { libraryStore } from "../../store/library-store";
import type { StoredBook } from "@/services/storage/storage-types";

vi.mock("@/services/storage/groupings", () => ({
  getGrouping: vi.fn(),
  getMembersForGrouping: vi.fn(),
}));

vi.mock("../../actions/load-library", () => ({
  loadLibrary: vi.fn(async () => {}),
}));

vi.mock("@/components/toast/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("useGroupingBooks error messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryStore.setState({
      books: [
        { id: "b1", title: "Foundation", createdAt: 1, fileHash: "h1" },
      ] as StoredBook[],
      isLoading: false,
      error: null,
    });
  });

  it("toasts an error and stops loading when the grouping fetch fails", async () => {
    const groupings = await import("@/services/storage/groupings");
    const { notify } = await import("@/components/toast/toast");
    vi.mocked(groupings.getGrouping).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(groupings.getMembersForGrouping).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useGroupingBooks("g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(notify.error).toHaveBeenCalled();
    expect(result.current.grouping).toBeNull();
  });
});

describe("useGroupingBooks on a refresh", () => {
  it("does a full (non-silent) library load when the store is empty", async () => {
    vi.clearAllMocks();
    libraryStore.setState({ books: [], isLoading: false, error: null });
    const groupings = await import("@/services/storage/groupings");
    vi.mocked(groupings.getGrouping).mockResolvedValueOnce(undefined);
    vi.mocked(groupings.getMembersForGrouping).mockResolvedValueOnce([]);

    renderHook(() => useGroupingBooks("g1"));

    // A silent load only merges into books already in the store, so on a
    // hard refresh it would leave the shelf empty.
    await waitFor(() => expect(loadLibrary).toHaveBeenCalledWith());
  });
});
